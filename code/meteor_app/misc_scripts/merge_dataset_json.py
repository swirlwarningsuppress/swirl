

import json


import glob


def find_json_files(prefix):
    return glob.glob(prefix + '*.json')

# first, Cipher init
benchmark_jsons = find_json_files('cryptoapi_bench_init')

# merge them
merged_json = []
for json_file in benchmark_jsons:
    with open(json_file, 'r') as f:
        json_obj = json.loads(f.read())
        merged_json.extend(json_obj)

# write to file
with open('cryptoapi_bench_init.json', 'w') as f:
    f.write(json.dumps(merged_json))

# second, MessageDigest digest
benchmark_jsons = find_json_files('cryptoapi_bench_digest')

# merge them
merged_json = []
for json_file in benchmark_jsons:
    with open(json_file, 'r') as f:
        json_obj = json.loads(f.read())
        merged_json.extend(json_obj)

# write to file
with open('cryptoapi_bench_digest.json', 'w') as f:
    f.write(json.dumps(merged_json))


# third, SecureRandom random

benchmark_jsons = find_json_files('cryptoapi_bench_random')

# merge them
merged_json = []
for json_file in benchmark_jsons:
    with open(json_file, 'r') as f:
        json_obj = json.loads(f.read())
        merged_json.extend(json_obj)

# write to file
with open('cryptoapi_bench_random.json', 'w') as f:
    f.write(json.dumps(merged_json))
    
