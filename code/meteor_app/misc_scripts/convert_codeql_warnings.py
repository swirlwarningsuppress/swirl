# go through the list of codeql warnings in sarif file
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


def load_json(file_path):
    with open(file_path, 'r') as file:
        sarif_data = json.load(file)
    return sarif_data

def extract_steps(thread_flows, step_count):
    # TODO, there are more than one step, so step_count isn't always example_id + 1
    steps = []
    
    
    for thread_flow_i, thread_flow in enumerate(thread_flows):
        locations = thread_flow.get('locations', [])
        
        for location_i, location in enumerate(locations):
            physical_location = location.get('location', {}).get('physicalLocation', {})
            artifact_location = physical_location.get('artifactLocation', {})
            region = physical_location.get('region', {})
            
            file_path = artifact_location.get('uri')
            start_line = region.get('startLine')
            method_name = location.get('state', {}).get('message')  # Assuming method name is provided in the state message
            
            # step_count += 1
            step = {
                'line': start_line,
                'source': file_path,
                'filepath': file_path,
                'methodName': method_name,
                'exampleID': step_count
            }
            steps.append(step)
            break # HJ: just the source is enough
    return steps

def extract_results(sarif_data, repo_url):
    """Extract results from SARIF data and convert them into the required JSON format."""
    results_list = []
    example_id = 0  # Initialize example ID counter
    runs = sarif_data.get('runs', [])
    
    for run in runs:
        results = run.get('results', [])
        for result in results:
            example_id += 2  # Increment example ID for each warning
            
            # rule_id = result.get('ruleId')
            message = result.get('message', {}).get('text')
            locations = result.get('locations', [])
            method_name = None  # You can implement specific logic to derive this from message or location
            
            code_flows = result.get('codeFlows', [])
            steps = []
            for code_flow in code_flows:
                thread_flows = code_flow.get('threadFlows', [])
                steps.extend(extract_steps(thread_flows, example_id + 1))
            
            for location in locations:
                physical_location = location.get('physicalLocation', {})
                artifact_location = physical_location.get('artifactLocation', {})
                region = physical_location.get('region', {})
                
                file_path = artifact_location.get('uri')
                start_line = region.get('startLine')
                

                url = os.path.join(repo_url, 'blob', 'main', file_path) + f'#L{start_line}'
                
                raw_code = fetch_github_content(repo_url, commit, file_path)
                
                sink = derive_sink_from_message(message)
                
                result_json = {
                    'url': url,
                    'rawCode': raw_code,
                    'methodName': method_name,
                    'exampleID': example_id,
                    'dataset': "codeql",
                    'filepath': file_path,
                    'line': start_line,
                    'sink': sink,
                    'source': '-',
                    'sourceLine': start_line,
                    'qualifier': message,
                    'line_number': start_line,
                    'steps': steps
                }
                
                results_list.append(result_json)
    
    return results_list


def derive_sink_from_message(message):
    words = message.split()
    for word in words:
        if '.' in word:
            return word
    return None 


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

import os



sarif_file_path = sys.argv[1]
warning_type = sys.argv[2]
github_repo = sys.argv[3]
commit = sys.argv[4]


sarif_data = load_json(sarif_file_path)

results = extract_results(sarif_data, github_repo)


with open('codeql_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type + '.json', 'w') as f:
    json.dump(results, f, indent=4)
print('wrote to the present directory. Move it to where Active learning interface expects it to be.')


if not os.path.exists(project_path + '/Surf/code/meteor_app/full_source/codeql_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type):
    os.mkdir(project_path + '/Surf/code/meteor_app/full_source/codeql_warnings_' +  github_repo.replace('/', '_') + '_' + warning_type)


print('done')