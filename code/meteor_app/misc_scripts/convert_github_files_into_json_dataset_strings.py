# go through the list of python files in the directory ~/repos/active_learning_interface/CryptoAPI-Bench
import glob
import json
import re 
import os
import shutil

cwd = os.getcwd()
project_path = cwd.split('Surf')[0] 


def get_all_java_files():
    print(project_path + '/GithubExamples/crypto/*.java*')
    return glob.glob(project_path + '/GithubExamples/crypto/*.java*', recursive=True)

def extract_url(file_path):

    return 'dummy'

def extract_raw_code(content, linenum, start_colnum, end_colnum):
    # extract based on linenum and colnum
    content = content.split('\n')
    # print(content)
    # print(linenum)
    # print(colnum)
    print(content[linenum-1][start_colnum:end_colnum])
    return content[linenum-1][start_colnum:end_colnum]


test_files = ['']


def convert_to_json(files):
    json_data = []  # list to hold JSON objects for each file

    # for github, we start at a higher initial count
    count = 1000
    # print(len(files))

    for java_file in files:
        print(java_file)
        
        
        with open(java_file, 'r') as f:
            # read the content of the file
            content = f.read()
            # extract the required information from the content
            url = extract_url(java_file)
            raw_code = extract_raw_code(content)
            if raw_code == '':
                break
            example_id = count
            dataset = 'crypto'

        
            # create a JSON object with the extracted data
            json_obj = {
                'url': url,
                'rawCode': raw_code,
                'exampleID': example_id,
                'dataset': dataset,
                'filepath': java_file
            }
            # print(java_file)
            if java_file.split('/')[-1] in test_files:
                json_obj['test'] = True
                print('test!')
            
            json_data.append(json_obj)
            count+=1

    print(count)
    # return the list of JSON objects as a JSON array
    return json.dumps(json_data)



# print(get_all_java_files())
json_obj = convert_to_json(get_all_java_files())

with open('crypto_warnings.json', 'w') as f:
    f.write(json_obj)
print('wrote to the present directory. Move it to where Active learning interface expects it to be.')


# next, move the source files into /Users/.../repos/active_learning_interface/Surf/code/meteor_app/full_source/cryptoapi_bench_Cipher
if not os.path.exists(project_path + '/Surf/code/meteor_app/full_source/crypto_warnings'):
    os.mkdir(project_path + '/Surf/code/meteor_app/full_source/crypto_warnings')
for java_file in json.loads(json_obj):
    # print(java_file)
    example_id = java_file['exampleID']
    filepath = java_file['filepath']
    # print(filepath)
    if not os.path.exists(project_path + '/Surf/code/meteor_app/full_source/crypto_warnings/' + str(example_id)):
        os.mkdir(project_path + '/Surf/code/meteor_app/full_source/crypto_warnings/' + str(example_id))
    shutil.copyfile(filepath, project_path + '/Surf/code/meteor_app/full_source/crypto_warnings/' + str(example_id) + '/' + os.path.basename(filepath))

print('wrote to ' + project_path + '/Surf/code/meteor_app/full_source/crypto_warnings')
print('done')