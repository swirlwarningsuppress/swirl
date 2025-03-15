import requests
import re
import os


url_pattern = r'\[.*?\]\((.*?)\)'

urls = []
with open('/Users/xxx/repos/codeql_results/codeql_analysis/codeql_latest_analysis/apache-hbase.md') as infile:
    for line in infile:
        if line.startswith('['):
            urls.append(re.findall(url_pattern, line)[0])


# test
urls.append('https://github.com/apache/iceberg/blob/7da759bd9e86682ad5e8345f381a5284a9de480d/aliyun/src/test/java/org/apache/iceberg/aliyun/oss/mock/AliyunOSSMockLocalStore.java#L81')
# interface
urls.append('https://github.com/apache/iceberg/blob/7da759bd9e86682ad5e8345f381a5284a9de480d/aws/src/main/java/org/apache/iceberg/aws/s3/S3OutputStream.java#L142')
# interface
urls.append('https://github.com/apache/iceberg/blob/7da759bd9e86682ad5e8345f381a5284a9de480d/aws/src/main/java/org/apache/iceberg/aws/s3/S3OutputStream.java#L224')
# true warning
urls.append('https://github.com/apache/ofbiz-framework/blob/c27698e8eac9282395936c0e4db52c8c421abb93/framework/base/src/main/java/org/apache/ofbiz/base/crypto/HashCrypt.java#L233')
# true
urls.append('https://github.com/apache/ofbiz-framework/blob/c27698e8eac9282395936c0e4db52c8c421abb93/framework/base/src/main/java/org/apache/ofbiz/base/crypto/DesCrypt.java#L49')


if not os.path.exists('/Users/xxx/repos/suppression_interface/GithubExamples/crypto'):
    os.makedirs('/Users/xxx/repos/suppression_interface/GithubExamples/crypto')

for url in urls:
    # download after converting the github url into the raw url
    raw_url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob', '').split('#')[0]
    
    r = requests.get(raw_url)
    
    # write to local in the GithubExamples directory
    with open('/Users/xxx/repos/suppression_interface/GithubExamples/crypto/' + url.split('/')[-1], 'w') as outfile:
        outfile.write(r.text)
    


