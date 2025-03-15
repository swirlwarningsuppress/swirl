Install clingo:
```
python3 -m pip install --user --upgrade clingo
```


Running
=======

For the spotbugs data,
go to http://localhost:3000/?dataset=spotbugs

To use the baseline,
go to http://localhost:3000/?baseline=true

Therefore:
1. To load WarningInspector with spotbugs:
Run `WARNING_TYPE=apache_lucene-solr__NULL_ WARNING_JSON_NAME=spotbugs_warnings_apache_lucene-solr__NULL_ meteor`
and go to http://localhost:3000/?dataset=spotbugs&baseline=true

2. To load WarningInspector with Infer 
Run `WARNING_JSON_NAME=infer_warnings_alibaba_nacos_NULL_DEREFERENCE meteor `
and go to http://localhost:3000/?dataset=infer&baseline=true

3. To load SWIRL with Spotbugs:
Run `WARNING_TYPE=apache_lucene-solr__NULL_ WARNING_JSON_NAME=spotbugs_warnings_apache_lucene-solr__NULL_ meteor`
and go to http://localhost:3000/?dataset=spotbugs

4. To load SWIRL with Infer:
Run `WARNING_JSON_NAME=infer_warnings_alibaba_nacos_NULL_DEREFERENCE meteor `
and go to http://localhost:3000/?dataset=infer

5. Codeql:
WARNING_TYPE=dubbo_external WARNING_JSON_NAME=codeql_warnings_apache_dubbo_dubbo_external ~/.meteor/meteor
http://localhost:3000/?dataset=dubbo_external

Use one of the following commands to start SWIRL:

```
WARNING_JSON_NAME=infer_warnings_alibaba_nacos_NULL_DEREFERENCE meteor 

WARNING_TYPE=RESOURCE_LEAK__presto WARNING_JSON_NAME=infer_warnings_prestodb_presto_RESOURCE_LEAK meteor 

WARNING_TYPE=NULL_DEREFERENCE__toy_analysis WARNING_JSON_NAME=infer_warnings_xxx_toy_analysis_NULL_DEREFERENCE meteor

WARNING_TYPE=RESOURCE_LEAK__toy_analysis WARNING_JSON_NAME=infer_warnings_xxx_toy_analysis_RESOURCE_LEAK meteor

WARNING_TYPE=apache_lucene-solr__NULL_ WARNING_JSON_NAME=spotbugs_warnings_apache_lucene-solr__NULL_ meteor 

WARNING_TYPE=dubbo_external WARNING_JSON_NAME=codeql_warnings_apache_dubbo_dubbo_external ~/.meteor/meteor 

```


Notes on simulation
=================
```
python3 simulate.py RESOURCE_LEAK__presto   meteor_app/_ground-truth_infer_resource_leaks.txt 
```

```
python3 simulate.py apache_lucene-solr__NULL_ meteor_app/_ground-truth_spotbugs_labels.txt
```
