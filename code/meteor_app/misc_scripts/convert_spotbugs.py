# go through the list of spotbugs records
import glob
import json
import re 
import os
import shutil
import sys
import requests
from xml.etree import ElementTree as ET
# from IPython import embed
import subprocess


cwd = os.getcwd()
project_path = cwd.split('Surf')[0] 

project_source_path = '/Users/xxx/repos/suppression_interface/sourceDirectories/lucene-solr/'

# read environment variables
# START and END
try:
    START = int(os.environ['START'])
    END = int(os.environ['END'])
except:
    START = 0
    END = 100000


def extract_url(repo, commit, filepath):

    url = 'https://raw.githubusercontent.com/' + repo + '/' + commit + '/'  + filepath
    return url


def extract_readable_url(repo, commit, filepath):
    url = f'https://github.com/{repo}/blob/{commit}/{filepath}'
    return url


def locate_filepath_from_classname(expected_filepath_portion, name, directory):
    print('locate_filepath_from_classname', expected_filepath_portion, name, directory)
    process = subprocess.Popen(['find', directory, '-name', name], stdout=subprocess.PIPE)
    stdout = process.communicate()[0]
    filepaths = stdout.decode('utf-8').strip()


    matched_none = True
    for filepath in filepaths.split():
        if expected_filepath_portion in filepath:
            matched_none = False
            print('locate_filepath_from_classname', name, ' -> ', filepath)
            return filepath.split(directory)[1]

    if matched_none:
        print('matched_none', name, 'expected_filepath_portion=', expected_filepath_portion, )

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
        print('response ', url, response.status_code )
        if response.status_code == 404:
            github_cache[url] = None
        return None

def convert_to_surf_json(github_repo, commit, spotbug_warnings):
    print('==========')
    json_data = []  # list to hold JSON objects for each file

    print('got len', len(spotbug_warnings))
    count = 0
    for spotbugs_warning in spotbug_warnings[START:END]:

        url = 'dummy'
        print(spotbugs_warning['filepath'])
        content = fetch_github_content(github_repo, commit, spotbugs_warning['filepath'])

        
        source = spotbugs_warning[ 'source']
        
        source_line = spotbugs_warning[ 'sourceLine']
        
        sink_line = spotbugs_warning[ 'sinkLine']

        # create a JSON object with the extracted data
        json_obj = {
            'url': url,
            'rawCode': content,
            'methodName': spotbugs_warning['methodName'],
            'exampleID': count,
            'dataset': 'spotbugs',
            'filepath': spotbugs_warning['filepath'],
            'line': sink_line,
            'source': source,
            'sourceLine': source_line,
            'qualifier': 'Possible null pointer dereference' + (('of $$' +source + '/$') if source != '?' else ''),
            'steps': [
                {
                    'exampleID': count + 1,
                }
            ],
            'url': extract_readable_url(github_repo, commit, spotbugs_warning['filepath']),
            'line_number': source_line,
            
        }
        
        json_data.append(json_obj)
        count+=2

    print(count)
    # return the list of JSON objects as a JSON array
    return json.dumps(json_data)


def load_spotbugs_warnings(spotbugs_warning_path, warning_type):
    if not spotbugs_warning_path.endswith('xml'):
        raise Exception('spotbugs_warning_path must be a xml file')
    
    tree = ET.parse(spotbugs_warning_path)
    root = tree.getroot()


    bug_instances = []
    # Iterate over each BugInstance of type matching "*_NULL_*"
    for bug_instance in root.findall('.//BugInstance'):
        bug_type = bug_instance.get('type')
        if warning_type in bug_type:
            try:
                method_name = bug_instance.find('.//Method').get('name')
                file_path = bug_instance.find('.//SourceLine').get('sourcepath')
                var_name = bug_instance.find('.//LocalVariable').get('name')
                
                # print(method_name, file_path, var_name)
                # Extract lines
                line_assign_null = bug_instance.find('.//SourceLine[@role="SOURCE_LINE_DEREF"]').get('start')
                # print(line_assign_null)

                line_dereference = bug_instance.find('.//SourceLine[@role="SOURCE_LINE_NULL_VALUE"]')
                if line_dereference is None:
                    line_dereference = line_assign_null
                else:
                    line_dereference = line_dereference.get('start')
                # print(line_dereference)

                file_path = locate_filepath_from_classname(file_path, file_path.split('/')[-1], project_source_path)
                
                # Append to the list
                bug_instances.append({
                    'methodName': method_name,
                    'filepath': file_path,
                    'source': var_name,
                    'sourceLine': line_assign_null,
                    'sinkLine': line_dereference
                })
            except Exception as e:
                print(e)
                # embed()
                continue

        
    return bug_instances

spotbugs_warning_path = sys.argv[1] # 'lucene-solr-spotbugs.xml'
warning_type = sys.argv[2] # '_NULL_'
github_repo = sys.argv[3] # apache/lucene-solr
commit = sys.argv[4] # 43535fecb8455b3f9364f447e129ae05f79697e2

print('spotbugs_warning_path', spotbugs_warning_path)
print('warning_type', warning_type)
# run thisscript as 
# python3 convert_spotbugs.py lucene-solr-spotbugs.xml _NULL_ apache/lucene-solr 43535fecb8455b3f9364f447e129ae05f79697e2

json_obj = convert_to_surf_json(github_repo, commit, load_spotbugs_warnings(spotbugs_warning_path, warning_type))

with open('spotbugs_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type + '.json', 'w') as f:
    f.write(json_obj)
print('wrote to the present directory. Move it to where Active learning interface expects it to be.')


if not os.path.exists(project_path + '/Surf/code/meteor_app/full_source/spotbugs_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type):
    os.mkdir(project_path + '/Surf/code/meteor_app/full_source/spotbugs_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type)


print('done')