# go through the list of infer warnings 
import glob
import json
import re 
import os
import shutil
import sys
import requests

cwd = os.getcwd()
project_path = cwd.split('Surf')[0] 

# read environment variables
# START and END
try:
    START = int(os.environ['START'])
    END = int(os.environ['END'])
except:
    START = 0
    END = 100000


def extract_url(repo, commit, filepath):

    url = 'https://raw.githubusercontent.com/' + repo + '/' + commit + '/' + filepath
    return url

def extract_readable_url(repo, commit, filepath):
    url = f'https://github.com/{repo}/blob/{commit}/{filepath}'
    return url


test_files = ['']

github_cache = {}



def fetch_github_content(repo, commit, filepath):
    url = extract_url(repo, commit, filepath)
    if url in github_cache:
        return github_cache[url]

    # print(url)
    response = requests.get(url)
    if response.status_code == 200:
        github_cache[url] = response.text
        return response.text
    else:
        print(response.status_code )
        if response.status_code == 404:
            github_cache[url] = None
        return None


def convert_to_surf_json(github_repo, commit, infer_warnings):
    json_data = []  # list to hold JSON objects for each file

    count = 0
    for infer_warning in infer_warnings[START:END]:
        # with open(java_file, 'r') as f:
        #     # read the content of the file
        #     content = f.read()
        #     # extract the required information from the content
        #     url = extract_url(java_file)
        #     raw_code = extract_raw_code(content)
        #     if raw_code == '':
        #         break
        #     example_id = count
        #     dataset = 'resource'

        url = 'dummy'
        content = fetch_github_content(github_repo, commit, infer_warning['file'])


        # identifying the start step
        # parse the qualifier 
        qualifier = infer_warning['qualifier'].split('\n')[0]
        source = qualifier.split('`')[1]
        # find number in qualifier
        source_line = int(re.findall(r'\d+', qualifier)[0])
        try:
            sink = qualifier.split('`')[3]
        except:
            # sink is same as source
            sink = source
        
        sink_line = int(re.findall(r'\d+', qualifier)[-1])

        # enumerate the trace, and find the first line that contains the source
        found_source = False
        start_recording = False
        records = []
        source_info = {}

        methodNameStack = []
        methodStart = {}
        methodEnd = {}

        infer_explore = [] # for baseline, just show same info as `infer explore`
        for trace in infer_warning['bug_trace']:
            trace_content = fetch_github_content(github_repo, commit, trace['filename'])

            # baseline
            baseline_trace = trace.copy()
            baseline_trace['snippet'] = ''
            # trace_content.split('\n')[trace['line_number'] - 3 : trace['line_number'] -1] + '> ' +trace_content.split('\n')[trace['line_number'] - 1] + trace_content.split('\n')[trace['line_number'] : trace['line_number'] + 2] 
            if trace_content and trace['line_number'] != -1:
                for baseline_linenum in range(trace['line_number'] - 3, trace['line_number'] + 2):
                    if baseline_linenum == trace['line_number'] -1 :
                        baseline_trace['snippet'] += str(baseline_linenum) + '. ' + '> ' + trace_content.split('\n')[baseline_linenum] + '\n'
                    else:
                        baseline_trace['snippet'] += str(baseline_linenum) + '. ' + trace_content.split('\n')[baseline_linenum] + '\n'
                
            infer_explore.append(baseline_trace)


            if trace['level'] == 0 and trace['line_number'] == source_line:
                found_source = True
                start_recording = True
                # print('found source', infer_warning['file'], source_line, trace)
            elif trace['level'] == 0 or trace['line_number'] == -1:
                continue
                # pass
            #     found_source = False
            else:
                if 'return from'  in trace['description'] and (len(records) > 0 and 'return' in records[-1]['snippet']) and trace['level'] ==0 :
                    start_recording = False
                if start_recording:
                    trace_expanded = trace
                    
                    if not trace_content:
                        # print('could not fetch content for ' + trace['filename'])
                        pass
                    else:
                        # trace_line_numbers = (trace['line_number'] - 2, trace['line_number'] + 2)
                        # trace_snippet = '\n'.join(trace_content.split('\n')[trace_line_numbers[0]:trace_line_numbers[1]])
                        trace_snippet = trace_content.split('\n')[trace['line_number'] - 1]

                        trace_expanded['snippet'] = trace_snippet

                        trace_expanded['url'] = extract_readable_url(github_repo, commit, trace['filename'])
                        if 'start of procedure ' in trace['description']:
                            trace_expanded['methodName'] = trace['description'].split('start of procedure ')[1].split('(')[0]
                            methodNameStack.append(trace_expanded['methodName'])
                        else:
                            # same method as the previous trace
                            if len(records) > 0:
                                trace_expanded['methodName'] = methodNameStack[-1] # records[-1]['methodName']
                        
                        records.append(trace_expanded)
                if 'return from a call ' in trace['description']:
                    # print('return from a call', methodNameStack)
                    if methodNameStack:
                        methodNameStack.pop()
                if 'return from'  in trace['description'] and trace['level'] ==0 :
                    start_recording = False
                if found_source:
                    source_info['line']     = trace['line_number']
                    # source_info['source']   = 
                    source_info['filepath'] = trace['filename']

                    print('found source:', trace)
                    if 'start of procedure ' in trace['description']:
                        source_info['methodName'] = trace['description'].split('start of procedure ')[1].split('(')[0]

                    found_source = False
                    # print(source_info)


        combined_records = []
        for record in records:
            # for records with the same filename and method name, combine them
            if combined_records and combined_records[-1]['filename'] == record['filename'] and combined_records[-1]['methodName'] == record['methodName'] and combined_records[-1]['level'] == record['level']:
                # if combined_records[-1]['line_number'] != record['line_number']:
                    # combined_records[-1]['snippet'] += '\n' + record['snippet']

                combined_records[-1]['line_number'] = record['line_number']
                combined_records[-1]['line_numbers'].append(record['line_number'])
                
                combined_records[-1]['methodName'] = record['methodName']

                insert_code_for_combined_records(github_repo, commit, combined_records, record)
            else:
                combined_records.append(record.copy())
                combined_records[-1]['line_numbers'] = [record['line_number']]

                insert_code_for_combined_records(github_repo, commit, combined_records, record)


        if 'filepath' in source_info: 
            source_classname = source_info['filepath'].split('/')[-1].split('.')[0] + '.'
        else:
            source_classname = ''
        # create a JSON object with the extracted data

        null_verb = 'return' if '(' in source  else 'be'
        json_obj = {
            'url': url,
            'rawCode': content,
            'methodName': infer_warning['procedure'],
            'exampleID': count,
            'dataset': 'infer',
            'filepath': infer_warning['file'],
            'line': sink_line,
            'sink': sink,
            'source': source,
            'sourceLine': source_line,
            'qualifier': ('$$' +source + '/$ could ' + null_verb + ' null, and is @@dereferenced by ' +sink + '/@') if source != sink else ('$$' + source + '/$ could ' + null_verb + ' null, and is @@dereferenced/@'),
            'steps': [
                {
                    'line': source_info['line'] if 'line' in source_info else source_line,
                    'source': source,
                    'filepath': source_info['filepath'] if 'filepath' in source_info else infer_warning['file'],
                    'methodName': source_classname + source_info['methodName'] if 'methodName' in source_info else infer_warning['procedure'],
                    'exampleID': count + 1,
                }
            ],
            'url': extract_readable_url(github_repo, commit, infer_warning['file']),
            'line_number': source_line,
            'records': records,
            'combined_records': combined_records,
            'infer_explore': infer_explore,
        }
        
        json_data.append(json_obj)
        count+=2

    print(count)
    # return the list of JSON objects as a JSON array
    return json.dumps(json_data)

def insert_code_for_combined_records(github_repo, commit, combined_records, record):
    full_trace_content = fetch_github_content(github_repo, commit, record['filename'])
    max_line_number = max(combined_records[-1]['line_numbers'])
    min_line_number = min(combined_records[-1]['line_numbers'])

    combined_records[-1]['snippet'] = ''
    split_content = full_trace_content.split('\n')
    for line_i in range(min_line_number - 2, max_line_number + 1):
        if (line_i) in combined_records[-1]['line_numbers'] and split_content[line_i].strip() != '}':
            combined_records[-1]['snippet'] += str(line_i - 1) + '.' +  '> ' + split_content[line_i] + '\n'
        else:
            combined_records[-1]['snippet'] += str(line_i - 1) + '.' +  split_content[line_i] + '\n'

def load_infer_warnings(infer_warning_path, warning_type):
    infer_warnings = []
    if not infer_warning_path.endswith('json'):
        raise Exception('infer_warning_path must be a json file')
    
    for infer_warning_file in glob.glob(infer_warning_path):
        with open(infer_warning_file, 'r') as f:
            infer_warnings.extend(json.load(f))
        
    # filter by warning_type
    infer_warnings = [infer_warning for infer_warning in infer_warnings if infer_warning['bug_type'] == warning_type and 'generated-sources' not in infer_warning['file'] ]

    # reverse
    infer_warnings = infer_warnings[::-1]

    return infer_warnings

infer_warning_path = sys.argv[1]
warning_type = sys.argv[2]
github_repo = sys.argv[3]
commit = sys.argv[4]

json_obj = convert_to_surf_json(github_repo, commit, load_infer_warnings(infer_warning_path, warning_type))

with open('infer_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type + '.json', 'w') as f:
    f.write(json_obj)
print('wrote to the present directory. Move it to where Active learning interface expects it to be.')


if not os.path.exists(project_path + '/Surf/code/meteor_app/full_source/infer_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type):
    os.mkdir(project_path + '/Surf/code/meteor_app/full_source/infer_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type)


print('done')