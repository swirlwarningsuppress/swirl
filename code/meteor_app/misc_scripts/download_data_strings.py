import requests
import re
import os


url_pattern = r'\[.*?\]\((.*?)\)'

urls = [
    'https://github.com/opendaylight/yangtools/blob/502ec3268436a6f662fae661462baf3c2f73b5ad/common/yang-common/src/main/java/org/opendaylight/yangtools/yang/common/UnresolvedQName.java#L77C40-L77C60',
    'https://github.com/stanfordnlp/CoreNLP/blob/139893242878ecacde79b2ba1d0102b855526610/src/edu/stanford/nlp/util/Interner.java#L119C26-L119C59',
    'https://github.com/stanfordnlp/CoreNLP/blob/139893242878ecacde79b2ba1d0102b855526610/src/edu/stanford/nlp/util/concurrent/SynchronizedInterner.java#L135C15-L135C30',
    'https://github.com/stanfordnlp/CoreNLP/blob/139893242878ecacde79b2ba1d0102b855526610/src/edu/stanford/nlp/sequences/CoNLLDocumentReaderAndWriter.java#L215C11-L215C27',
    "https://github.com/stanfordnlp/CoreNLP/blob/139893242878ecacde79b2ba1d0102b855526610/src/edu/stanford/nlp/ie/EmpiricalNERPrior.java#L273C26-L273C40",
    "https://github.com/stanfordnlp/CoreNLP/blob/139893242878ecacde79b2ba1d0102b855526610/src/edu/stanford/nlp/trees/WordCatEqualityChecker.java#L22C16-L22C56",
    "https://github.com/stanfordnlp/CoreNLP/blob/139893242878ecacde79b2ba1d0102b855526610/src/edu/stanford/nlp/trees/international/french/FrenchXMLTreeReader.java#L140C8-L140C21",
    ]




if not os.path.exists('/Users/xxx/repos/suppression_interface/GithubExamples/strings'):
    os.makedirs('/Users/xxx/repos/suppression_interface/GithubExamples/strings')

for url in urls:
    # download after converting the github url into the raw url
    raw_url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob', '').split('#')[0]
    
    r = requests.get(raw_url)
    
    # write to local in the GithubExamples directory
    with open('/Users/xxx/repos/suppression_interface/GithubExamples/strings/' + url.split('/')[-1], 'w') as outfile:
        outfile.write(r.text)
    


