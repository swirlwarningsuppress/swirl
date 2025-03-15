import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';
import { Session } from 'meteor/session';

const fsPromises = require('fs').promises;
// import { TestExamples } from '../imports/api/options';

const { Configuration, OpenAIApi } = require("openai");



const util = require('util');

// import functions from matching.js
import { generateWildcardPatterns, generateWildcardPatternsForPrefix } from './matching.js';


var fs = require('fs');
var path = require('path');

export const Examples = new Mongo.Collection('examples');
export const TestExamples = new Mongo.Collection('testexamples');
export const ActionLog = new Mongo.Collection('actionlog');
export const Subgraphs = new Mongo.Collection('subgraphs');
export const Containment = new Mongo.Collection('containment');
export const Refinements = new Mongo.Collection('refinements');
export const Bags = new Mongo.Collection('bags');
export const Queries = new Mongo.Collection('queries');
export const Config = new Mongo.Collection('config');

const exec = Npm.require('child_process').exec;

var request_counter = 0;
var matchSink = true;
var experiment_id = 'test';

var subjectNum = -1;


// var warningType = "crypto__getInstance";
// var warningType = "RESOURCE_LEAK__drift";
var warningType = "NULL_DEREFERENCE__nacos";
warningType = process.env.WARNING_TYPE ? process.env.WARNING_TYPE : warningType; 

var warningShortName = warningType == "crypto__getInstance" ? "crypto_warnings" : process.env.WARNING_JSON_NAME;

// get current path
var path = Npm.require('path');
console.log(path.resolve('.'));
var projectPath = path.resolve('.').split('/code')[0];
var appPath = projectPath + "/code/meteor_app/";

var maxNumRuleSeenSoFar = 3;

var openaiApiKey = "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"

Meteor.startup(() => {

  //to load new data into the database, run this command:
  //mongoimport --db test --collection <collectionName> --drop --file ~/downloads/<data_dump>.json
  console.log('start-up code running');
  console.log(Examples.find().count());

  var reload = true; 
  // var reload = false;
  if (reload){
    resetDatabase();
  }
});

var shellOutToReadSubgraphs = function(request_number, focalNode, eraseOld, showImmediately) {

  // reset the subgraphs, but do not clear the bagged patterns
  // or the patterns that are already labeled
  if (focalNode == 'pseudo-node' || eraseOld) {
  
    console.log('clear  subgraphs and more');
    // var  a = Subgraphs.remove({'$and': [{ 'labelled': {'$ne': true} }, {'hint':{'$ne': true} } ,{ '$or': [ {'bag' : {'$exists': false}}, {'bag': {$eq: null}}  ]}]});

    // Subgraphs.remove({'$and': [{ 'labelled': {'$ne': true} },);

    Subgraphs.remove({ '$and' : 
      [
        {'discriminative': true},  
        {'hidden': {'$ne': true}},
        {'$or': [{ 'bags': { '$exists': false } }, { 'bags': { $eq: null } }]}
      ]
    });
    // console.log(a);
  } 


  spawn = Npm.require('child_process').spawn;
  

  console.log('reading subgraphs');
  console.log('request_number', request_number);
  
  command = spawn('python3',[appPath + "misc_scripts/debug_subgraphs.py", experiment_id, request_number, warningType]);
  console.log('python3', [appPath + "misc_scripts/debug_subgraphs.py", experiment_id, request_number, warningType].join(' '));

  // remove 'alternative' subgraphs
  Subgraphs.remove({'$and': [{'alternative': true}, { 'labelled': {'$ne': true} }, { '$or': [ {'bag' : {'$exists': false}}, {'bag': {$eq: null}}  ]}]});

  // keep track of the nodesToInclude that came from the feature-level feedback
  var nodesToInclude = {};
  Examples.find({explanationNode: {$exists: true}}).forEach(function(example) {
    var explanationNodes = example.explanationNode;
    var explanation = example.explanation;
    if (explanationNodes) {
      explanationNodes.forEach(function(explanationNode) {
        nodesToInclude[explanationNode] = explanation;
      });
    }
  });
  // console.log('[updateLabels]' + 'nodesToInclude mapping is ' + JSON.stringify(nodesToInclude));

  command.stdout.on('data',  Meteor.bindEnvironment(function (data) {
    data = data.toString();

    Subgraphs.find({discriminative:true, hidden:true, labelled:false}).forEach(function(subgraph) {
      // console.log('[discriminative=true] removing subgraph: ' + subgraph.rawText);
      Subgraphs.remove({_id: subgraph._id});
    });

    // console.log('[discriminative] subgraphs read: ' + data.toString());
    console.log('[discriminative] subgraphs read! ' );
    var numInserts = 0;
    // var text = '';
    for (var i=0; i<data.split('\n').length; i++){
      var text = data.split('\n')[i];
      var edges = [];
      var adjlist = {};

      var isPattern = null;
      if (data.split('\n')[i].length != 0) {
        if (text.length != 0) {

          if (text.split(',').length >= 2 ) {
            var fragments = text.split(',');
            

            for (var j=0; j<fragments.length; j++) {

              if (fragments[j].trim().length == 0) {
                continue;
              }
              // the last fragment is just + or -
              if (fragments[j].trim().length == 1) {
                if (fragments[j].trim() == '+' || fragments[j].trim() == '-') {
                  isPattern = fragments[j].trim() == '+';
                } else {
                  throw new Error('unexpected fragment: ' + fragments[j]);
                }
                continue;
              }

              var fragmentParts = fragments[j].trim().split(' ');
              var nodeLabel1 = fragmentParts[0];
              var nodeLabel2 = fragmentParts[2];
              var edgeLabel = fragmentParts[3];

              // temporary, ignore UNKNOWNs
              if (nodeLabel1 == 'UNKNOWN' || nodeLabel2 == 'UNKNOWN' ) {
                console.log('UNKNOWN found, skipping');
                continue;
              }
    
              // console.log(text);
              if (nodeLabel1.includes('.')) {
                nodeLabel1 = nodeLabel1.replace(/\./g, '__');
              }
              if (nodeLabel2.includes('.')) {
                nodeLabel2 = nodeLabel2.replace(/\./g, '__');
              }

              edges.push({from: nodeLabel1, to: nodeLabel2, label: edgeLabel, rawText:fragments[j]});
              if (adjlist[nodeLabel1] == undefined) {
                adjlist[nodeLabel1] = [];
              }
              if (adjlist[nodeLabel2] == undefined) {
                adjlist[nodeLabel2] = [];
              }
              adjlist[nodeLabel1].push({to: nodeLabel2, label: edgeLabel});
            }
          } else {
            var fragments = text.split(',');
            var isPattern = fragments[fragments.length - 1].trim() == '+';
            var nodeLabel1 = fragments[0].trim().split(' ')[0];
            if (nodeLabel1.includes('.')) {
              nodeLabel1 = nodeLabel1.replace(/\./g, '__');
            }
            if (nodeLabel1 == 'UNKNOWN' || nodeLabel2 == 'UNKNOWN' ) {
              console.log('UNKNOWN found, skipping');
              continue;
            }
            
            adjlist[nodeLabel1] = [];
            adjlist[nodeLabel1].push({to: '', label: ''});
            edges.push({from: nodeLabel1, to: '', label: '', rawText:fragments[j]});
          }

            // check if adjlist contains any of nodesToInclude
 

            Subgraphs.insert({rawText: text, edges: edges, adjlist: adjlist, discriminative:true, alternative: true, isPattern:isPattern, 
               debug_added_from:'d', hidden: true, 
              labelled:false, debug_request_number: request_number, insertion_order: numInserts++});
            

            // console.log('[discriminative=true] inserted  '+ text + ' with subgraphId=' + i);
          

          
          text = '';
        }
      }
    }

    var totalDiscriminativeSubgraphs = i;
    // console.log('totalDiscriminativeSubgraphs =', totalDiscriminativeSubgraphs);

    console.log('console.log(Subgraphs.find({discriminative:true}).count()); = '  +Subgraphs.find({discriminative:true}).count());

    spawn = Npm.require('child_process').spawn;

    focalNode = focalNode.replace('__', '.');
   
    var totalDiscriminativeAndFrequentSubgraphs = totalDiscriminativeSubgraphs + i;
    console.log('totalDiscriminativeAndFrequentSubgraphs =', totalDiscriminativeAndFrequentSubgraphs);

    console.log('console.log(Subgraphs.find({}).count()); = '  +Subgraphs.find({}).count());

    var fetchAlternatives = false;

    if (fetchAlternatives) {
      spawn = Npm.require('child_process').spawn;

      console.log('reading alternative subgraphs', 'python3',[appPath + "misc_scripts/debug_alternative_subgraphs.py", experiment_id, request_number, warningType].join( ' '));
      command = spawn('python3',[appPath + "misc_scripts/debug_alternative_subgraphs.py", experiment_id, request_number, warningType]);

      
      command.stdout.on('data',  Meteor.bindEnvironment(function (data) {
        data = data.toString();

        console.log('[alternative] subgraphs read: ' + data.toString());
        // var text = '';
        for (var i=0; i< data.split('\n').length && i < 100; i++){ // TODO: remove the 100 limit
          var text = data.split('\n')[i];
          var edges = [];
          var adjlist = {};
          if (data.split('\n')[i].length != 0) {
            if (text.length != 0) {

              if (text.split(',').length >= 2 ) {
                var fragments = text.split(',');
                

                for (var j=0; j<fragments.length; j++) {

                  if (fragments[j].trim().length == 0) {
                    continue;
                  }
                  var fragmentParts = fragments[j].trim().split(' ');
                  var nodeLabel1 = fragmentParts[0];
                  var nodeLabel2 = fragmentParts[2];
                  var edgeLabel = fragmentParts[3];

                  if (nodeLabel1 == 'UNKNOWN' || nodeLabel2 == 'UNKNOWN' ) {
                    continue;
                  }

                  if (nodeLabel1.includes('.')) {
                    nodeLabel1 = nodeLabel1.replace(/\./g, '__');
                  }
                  if (nodeLabel2.includes('.')) {
                    nodeLabel2 = nodeLabel2.replace(/\./g, '__');
                  }

                  edges.push({from: nodeLabel1, to: nodeLabel2, label: edgeLabel, rawText:fragments[j]});
                  if (adjlist[nodeLabel1] == undefined) {
                    adjlist[nodeLabel1] = [];
                  }
                  if (adjlist[nodeLabel2] == undefined) {
                    adjlist[nodeLabel2] = [];
                  }
                  adjlist[nodeLabel1].push({to: nodeLabel2, label: edgeLabel});
                }
              } else {
                var fragments = text.split(',');
                var isPattern = fragments[fragments.length - 1].trim() == '+';
              
                var nodeLabel1 = fragments[0].trim().split(' ')[0];
                if (nodeLabel1.includes('.')) {
                  nodeLabel1 = nodeLabel1.replace(/\./g, '__');
                }
                if (nodeLabel1 == 'UNKNOWN' || nodeLabel2 == 'UNKNOWN' ) {
                  console.log('UNKNOWN found, skipping');
                  continue;
                }
                
                adjlist[nodeLabel1] = [];
                adjlist[nodeLabel1].push({to: '', label: ''});
                edges.push({from: nodeLabel1, to: '', label: '', rawText:fragments[j]});
              }
              
              // if (Subgraphs.find({rawText: text, alternative: true}).count() == 0 ) {
                Subgraphs.insert({ rawText: text, edges: edges, adjlist: adjlist, alternative:true, initiallyFrequent:false, debug_added_from: 'a', debug_request_number: request_number});
                console.log('[alternative, discriminative=false] inserted  '+ text + ' with subgraphId=' + (totalDiscriminativeAndFrequentSubgraphs+i));
              // } else {
              //   console.log('[alternative, discriminative=false] already exists, skipping:' + text);
              // }
              
              text = '';
            }
          }
        }
        
        console.log('console.log(Subgraphs.find({alternative:true}).count()); = '  +Subgraphs.find({alternative:true}).count());
        console.log('console.log(Subgraphs.find({).count()); = '  +Subgraphs.find({}).count());
      }));
    }

    if (showImmediately) {
      inferPatterns();
    }
  }));



    
  

  command.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  command.on('exit', Meteor.bindEnvironment(function (code) {
    console.log('child process exited with code ' + code);
    

    
  }));

}

function resetDatabase() {
  experiment_id = 'test';
  request_counter = 0;
  matchSink = true;

  // Session.set('request_counter', 0);
  Subgraphs.remove({});
  Examples.remove({});
  TestExamples.remove({});
  Bags.remove({});
  Queries.remove({});
  Containment.remove({});
  Refinements.remove({});
  Config.remove({});

  // clear projectPath + '/code/lp/' + warningType + '_labels.lp'
  // fs.writeFile(projectPath + '/code/lp/' + warningType + '_labels.lp', '', function (err) {
  // });
  fsPromises.writeFile(projectPath + '/code/lp/' + warningType + '_labels.lp', '')
    .then(() => {
      console.log('successfully cleared ' + projectPath + '/code/lp/' + warningType + '_labels.lp');
    }).then(() => {
      fsPromises.writeFile(projectPath + '/code/lp/specialize_rules.lp', '')

      fsPromises.writeFile(projectPath + '/code/lp/frozen_rules.lp', '')
      fsPromises.writeFile(projectPath + '/code/lp/selected_code_rules.lp', '')
    });;

  // console.log('reload',reload);
  // run script to reset graph mining data
  spawn = Npm.require('child_process').spawn;
  command = spawn('python3', [projectPath + "/code/reset_graphs_" + 'all' + ".py"]);
  command.stdout.on('data', function (data) {
    console.log('[reset_graph.sh] stdout: ' + data);
  });

  command.stderr.on('data', function (data) {
    console.log('[reset_graph.sh] stderr: ' + data);
  });

  command.on('exit', Meteor.bindEnvironment(function (data) {
    // console.log('[reset_graph.sh] child process exited with code ' + code);

    var exampleIdToOriginalDoc = {};
    Assets.getText( warningShortName + '.json', function (err, data) {
      var content = EJSON.parse(data);

      _.each(content, function (doc) {
        // 4 essential fields
        // url
        // rawCode
        // exampleID
        // dataset
        if (!doc['rawCode']) {
          return;
        }
        doc['codeLength'] = doc['rawCode'].length;

        if (!doc['label']) {
          doc['label'] = '?';
        } else {
          doc['prelabelled'] = true;
        }

        if (doc['test']) {
          TestExamples.insert(doc);
          console.log('insert test!');
        } else {
          Examples.insert(doc);
        }

        exampleIdToOriginalDoc[parseInt(doc['exampleID'])] = doc;

        // put source too
        if (doc['steps'].length > 0) {
          exampleIdToOriginalDoc[parseInt(doc['steps'][0]['exampleID'])] = doc['steps'][0];
        }

        console.log('inserted example ' + doc['exampleID']);

      });

     
      Assets.getText('original_graphs/' + warningType + '_graph_id_mapping.txt', function (err, data) {
        if (err) {
          console.log('error when reading graph_id_mapping)=' + err);
        }
        // console.log(  data  );
        var rows = data.split('\n');


        var graphdIdToExampleId = {};
        var graphIdToClassname = {};
        var exampleIdToPkg = {};
        var exampleIdToAncestry = {};
        var exampleIdToRetType = {};
        var exampleIdToFieldsUsed = {};

        var exampleCount = 0;
        // iterate over all Examples
        [Examples, TestExamples].forEach(function (Examples) {
          Examples.find({}).forEach(function (example) {

            // iterate over the exampleIds we care about:
            // 1. example.exampleID
            // 2. example.steps[0].exampleID
            var source = example.steps[0] ?  example.steps[0].exampleID : example.exampleID;
            [example.exampleID, source].forEach(exampleId => {
              // var exampleId = example.exampleID;
              var targetGraphId = -1;

              var classname = example.filepath.split('/').slice(-1)[0].split('.')[0];
              for (let i = 0; i < rows.length; i++) {
                var line = rows[i];

                if (line.length == 0) {
                  continue;
                }
                var graph_id = line.split(',')[1];
                var example_id = line.split(',')[2].split(' - ')[0];
                var lines = _.filter(example.rawCode.split(' '), function (item) { return item.includes('('); });
                for (let j = 0; j < lines.length; j++) {
                  var codeline = lines[j];
                  var methodName = codeline.split('(')[0];

 
                  if (line.split(',')[2].split(' - ')[1].includes(methodName) && example_id == exampleId) {
                    // console.log('found graph_id ' + graph_id + ' for example ' + exampleId + ' with method ' + methodName);
                    targetGraphId = graph_id;
                    break;
                  }
                }
              }


              if (targetGraphId != -1) {
                console.log('[matching example to graph] targetGraphId = ' + targetGraphId + ' for example ' + exampleId + ' of dataset ' + example.dataset);

                var a = Examples.update({ exampleID: parseInt(exampleId) }, { $set: { graphId: parseInt(targetGraphId), classname: classname, readableExampleID: exampleCount } }, function (error, result) {
                  if (error)
                    console.log('error when updating Examples with graphid---->' + error);
                  console.log('done updating graphid for example ' + exampleId + ' to ' + targetGraphId)
                });
                exampleCount += 1;

                // update Examples for example where steps[0].exampleID == exampleId
                var a = Examples.update({ 'steps.0.exampleID': parseInt(exampleId) }, { $set: { 'steps.0.graphId': parseInt(targetGraphId), 'steps.0.classname': classname } }, function (error, result) {
                  if (error)

                    console.log('error when updating Examples with graphid---->' + error);
                  // else
                  //   console.log('done updating graphid (in source) for example ' + exampleId + ' to ' + targetGraphId)
                });
                // console.log('updating graphid (in source) for example ' + exampleId + ' to ' + targetGraphId + '  ...  ' + a );

                graphdIdToExampleId[targetGraphId] = exampleId;
                graphIdToClassname[targetGraphId] = classname;
              }
            });
          });
        });

        Assets.getText('original_graphs/' + warningType + '_subtypingAncestry.txt', function (err, data) {
          if (err) {
            console.log('error when reading subtypingAncestry.txt =' + err);
          }

          var rows = data.split('\n');

          rows.forEach(function (row) {
            var exampleId =  row.split(',')[0].split(' ')[0];

            var ancestry = row.split(/,(?![^<>]*>)/).slice(1);

            // console.log('update ancestry of example ' + exampleId + ' to ' + ancestry);
            // filter out java.lang.Object
            ancestry = ancestry.filter(function (item) { return item != 'java.lang.Object'; });
            
            [Examples, TestExamples].forEach(function (Examples) {
              Examples.update({ exampleID: parseInt(exampleId) }, { $set: { ancestry: ancestry } }, function (error, result) {
                if (error)
                  console.log('error when updating Examples with ancestry---->' + error);
              });
              // update Examples for example where steps[0].exampleID == exampleId
              Examples.update({ 'steps.0.exampleID': parseInt(exampleId) }, { $set: { 'steps.0.ancestry': ancestry } }, function (error, result) {
                if (error)
                  console.log('error when updating Examples with ancestry---->' + error);
              });

            });
            exampleIdToAncestry[exampleId] = ancestry;


          });
        });

        Assets.getText('original_graphs/' + warningType + '_packages.txt', function (err, data) {
          if (err) {
            console.log('error when reading _packages.txt =' + err);
          }

          var rows = data.split('\n');

          rows.forEach(function (row) {
            var exampleId =  row.split(',')[0].split(' ')[0];

            var pkg = row.split(',')[1];

            // console.log('update pkg of example ' + exampleId + ' to ' + pkg)
            
            [Examples, TestExamples].forEach(function (Examples) {
              Examples.update({ exampleID: parseInt(exampleId) }, { $set: { pkg: pkg } }, function (error, result) {
                if (error)
                  console.log('error when updating Examples with pkg---->' + error);
                else {
                  // console.log('done updating pkg for example ' + exampleId + ' to ' + pkg)
                }
              }
              );

              // update Examples for example where steps[0].exampleID == exampleId
              Examples.update({ 'steps.0.exampleID': parseInt(exampleId) }, { $set: { 'steps.0.pkg': pkg } }, function (error, result) {
                if (error)
                  console.log('error when updating Examples with pkg---->' + error);
                else {
                  // console.log('done updating pkg for example ' + exampleId + ' to ' + pkg)
                }
              }
              );

            });

            exampleIdToPkg[exampleId] = pkg;

          });
        });

        Assets.getText('original_graphs/' + warningType + '_retType.txt', function (err, data) {
          if (err) {
            console.log('error when reading _retType.txt =' + err);
          }

          var rows = data.split('\n');

          rows.forEach(function (row) {
            var exampleId =  row.split(',')[0].split(' ')[0];

            var retType = row.split(',')[1];

            // console.log('update retType of example ' + exampleId + ' to ' + retType)
            
            // [Examples, TestExamples].forEach(function (Examples) {
            //   Examples.update({ exampleID: parseInt(exampleId) }, { $set: { retType: retType } }, function (error, result) {
            //     if (error)
            //       console.log('error when updating Examples with retType---->' + error);
            //     else {
            //       // console.log('done updating retType for example ' + exampleId + ' to ' + retType)
            //     }
            //   }
            //   );

            //   // update Examples for example where steps[0].exampleID == exampleId
            //   Examples.update({ 'steps.0.exampleID': parseInt(exampleId) }, { $set: { 'steps.0.retType': retType } }, function (error, result) {
            //     if (error)
            //       console.log('error when updating Examples with retType---->' + error);
            //     else {
            //       // console.log('done updating retType for example ' + exampleId + ' to ' + retType)
            //     }
            //   }
            //   );

            // });

            exampleIdToRetType[exampleId] = retType;

          });
        });

        Assets.getText('original_graphs/' + warningType + '_fieldsUsed.txt', function (err, data) {
          if (err) {
            console.log('error when reading _fieldsUsed.txt =' + err);
          }

          var rows = data.split('\n');

          rows.forEach(function (row) {
            var exampleId =  row.split(',')[0].split(' ')[0];

            var fieldsUsed = row.split(',')[1];

            // console.log('update fieldsUsed of example ' + exampleId + ' to ' + fieldsUsed)
            
            // [Examples, TestExamples].forEach(function (Examples) {
            //   Examples.update({ exampleID: parseInt(exampleId) }, { $set: { fieldsUsed: fieldsUsed } }, function (error, result) {
            //     if (error)
            //       console.log('error when updating Examples with fieldsUsed---->' + error);
            //     else {
            //       // console.log('done updating fieldsUsed for example ' + exampleId + ' to ' + fieldsUsed)
            //     }
            //   }
            //   );

            //   // update Examples for example where steps[0].exampleID == exampleId
            //   Examples.update({ 'steps.0.exampleID': parseInt(exampleId) }, { $set: { 'steps.0.fieldsUsed': fieldsUsed } }, function (error, result) {
            //     if (error)
            //       console.log('error when updating Examples with fieldsUsed---->' + error);
            //     else {
            //       // console.log('done updating fieldsUsed for example ' + exampleId + ' to ' + fieldsUsed)
            //     }
            //   }
            //   );

            // });

            exampleIdToFieldsUsed[exampleId] = fieldsUsed;

          });
        });

        // console.log(Examples.findOne()); 
        // load 
        Assets.getText('original_graphs/' + warningType + '_elementpositions.json', function (err, data) {
          if (err) {
            console.log('error when reading program element positions =' + err);
          }

          var element_position = EJSON.parse(data);
          console.log('element_position', Object.keys(element_position).length);

          var lp_content = '';

          // iterate over keys of element_position
          for (let i = 0; i < Object.keys(element_position).length; i++) {
            var key = Object.keys(element_position)[i];
            // console.log('reading element positions of graph ' + key + '...');
            var one_element_position = EJSON.parse(element_position[key]);
            var expressionStarts = one_element_position['expressionStart'];
            var expressionStartsAdditional = one_element_position['expressionStartAdditional'];
            var expressionEndsAdditional = one_element_position['expressionEndAdditional'];
            var expressionEnds = one_element_position['expressionEnd'];
            var expressionStartLines = one_element_position['expressionStartLine'];
            var rawCode = one_element_position['rawCode'];
            var rawCodeLineNumber= one_element_position['rawCodeLineNumbers'];

            var programElementToExpression = {};

            _.each(expressionStarts, function (start, startkey) {
              var end = expressionEnds[startkey];
              var startLine = expressionStartLines[startkey];
              var additional = expressionStartsAdditional[startkey];
              var additionalEnd = expressionEndsAdditional[startkey];

              if (startkey.includes('.')) {
                startkey = startkey.replace(/\./g, '__');
              }

              // ignore edges
              if (startkey.includes('->')) {
                return;
              }
              programElementToExpression[startkey] = {};
              programElementToExpression[startkey]['expressionStart'] = start;
              programElementToExpression[startkey]['expressionStartAdditional'] = additional;
              programElementToExpression[startkey]['expressionEndAdditional'] = additionalEnd;
              
              programElementToExpression[startkey]['expressionEnd'] = end;
              programElementToExpression[startkey]['startLine'] = startLine;
            });
            // console.log('setting', Object.keys(expressionStarts).length, 'element positions of graph ' + key + '...');
            programElementToExpression['codeElements'] = Object.keys(expressionStarts);
            programElementToExpression['rawCode'] = rawCode;
            programElementToExpression['rawCodeLineNumber'] = rawCodeLineNumber;

            programElementToExpression['classname'] = graphIdToClassname[key];
            programElementToExpression['graphId'] = parseInt(key);
            programElementToExpression['exampleID'] = graphdIdToExampleId[key];
            programElementToExpression['pkg'] = exampleIdToPkg[graphdIdToExampleId[key]];
            programElementToExpression['ancestry'] = exampleIdToAncestry[graphdIdToExampleId[key]];
            programElementToExpression['retType'] = exampleIdToRetType[graphdIdToExampleId[key]];
            programElementToExpression['fieldsUsed'] = exampleIdToFieldsUsed[graphdIdToExampleId[key]];

            var oldDocument = exampleIdToOriginalDoc[parseInt(graphdIdToExampleId[key])];
            if (oldDocument && oldDocument['line']) {
              programElementToExpression['line'] = oldDocument['line'];
            } else {
              // console.log('no line found for example ' + graphdIdToExampleId[key])
              // console.log('oldDocument', oldDocument);  
            }



            // Examples.find({graphId: parseInt(key)}).forEach(function (example) {
            // console.log('setting element positions of graph ' + key + '...' + 'with keys ' + Object.keys(programElementToExpression));
            [Examples, TestExamples].forEach(function (Examples) {
              Examples.update({ graphId: parseInt(key) }, { $set: programElementToExpression }, function (error, result) {
                if (error)
                  console.log('error when updating Examples with programElementToExpression---->' + error);
              });
              // update examples for steps[0].graphId == key
              Examples.update({ 'steps.0.graphId': parseInt(key) }, { $set: { 'steps.0': programElementToExpression} }, function (error, result) {
                if (error)
                  console.log('error when updating Examples with programElementToExpression---->' + error);
              });
            });


            
            

            if (graphdIdToExampleId[key] != undefined) {
              lp_content += 'example(' + graphdIdToExampleId[key] + ').\n';
              var lp_package = exampleIdToPkg[graphdIdToExampleId[key]]?.replace(/\./g, '__');

              
              if (lp_package) {
                lp_content += 'containment(' + graphdIdToExampleId[key] + ', ' + 'package_' + lp_package + ').\n';
              }
              if (exampleIdToPkg[graphdIdToExampleId[key]]) {
                var morePatterns = generateWildcardPatterns(exampleIdToPkg[graphdIdToExampleId[key]]);
                // console.log(morePatterns);
                morePatterns.forEach(function (pattern) {
                  lp_content += 'containment(' + graphdIdToExampleId[key] + ', ' + 'package_' + pattern.replace(/\./g, '__') + ').\n';
                });
              }
              var lp_classname = graphIdToClassname[key]?.replace(/\./g, '__');
              lp_content += 'containment(' + graphdIdToExampleId[key] + ', ' + 'class_' + lp_classname + ').\n';

              if (graphIdToClassname[key]) {
                // console.log(graphIdToClassname[key])
                var morePatterns = generateWildcardPatterns(graphIdToClassname[key]);

                // console.log(morePatterns);
                morePatterns.forEach(function (pattern) {
                  lp_content += 'containment(' + graphdIdToExampleId[key] + ', ' + 'class_' + pattern.replace(/\./g, '__') + ').\n';
                });
              }


              var lp_ancestry = exampleIdToAncestry[graphdIdToExampleId[key]];
              

              // console.log(lp_ancestry);
              for (let i = 0; i < (lp_ancestry ? lp_ancestry.length : 0); i++) {
                var lp_ancestor = lp_ancestry[i].replace(/\./g, '__').replace('[', '_lb').replace(']', '_rb').replace('<', '_lt').replace('>', '_gt');
                lp_content += 'containment(' + graphdIdToExampleId[key] + ', ' + 'subtype_' + lp_ancestor + ').\n';
                // console.log('containment(' + graphdIdToExampleId[key] + ', ' + 'subtype_' + lp_ancestor + ').\n');
              }
              
              var lp_retType = exampleIdToRetType[graphdIdToExampleId[key]];
              if (lp_retType) {
                lp_retType = lp_retType.replace(/\./g, '__').replace('[', '_lb').replace(']', '_rb').replace('<', '_lt').replace('>', '_gt');
                lp_content += 'containment(' + graphdIdToExampleId[key] + ', ' + 'ret_' + lp_retType + ').\n';
              }

              var lp_fieldsUsed = exampleIdToFieldsUsed[graphdIdToExampleId[key]];
              if (lp_fieldsUsed) {
                lp_fieldsUsed = lp_fieldsUsed.replace(/\./g, '__').replace('[', '_lb').replace(']', '_rb').replace('<', '_lt').replace('>', '_gt');
                lp_content += 'containment(' + graphdIdToExampleId[key] + ', ' + 'field_' + lp_fieldsUsed + ').\n';
              }
            }
            
          }
          // write to the  file background.lp
          fs.writeFile(projectPath + '/code/lp/background.lp', lp_content, function (err) {
            if (err) throw err;
            console.log('Saved!');
          });



        });

        // order the example id to set readableExampleID
        // adapted from xxx's code in 1dfb1d4e68fff379a865449f57ec3ba20ec6202d
        // var count = 0;
        // Examples.find({graphId: {$exists: true} }).forEach(function (example) {
        //   Examples.update({ exampleID: example.exampleID }, { $set: { readableExampleID: count } });
        //   console.log('updating exampleID' , example.exampleID, ' to ' + count);
        //   count++;
          
        // });


        

      });

    });

  }));
}



function computeSelector(subgraphs) {
  var selector = {};

  var nodes = {};
  var negateMatches = {}
  subgraphs.forEach(function(subgraph) {
    
    subgraph.edges.forEach(function(edge) {
      nodes[edge.from] = true;

      negateMatches[edge.from] = !_.isUndefined(subgraph.isPattern) && !_.isNull(subgraph.isPattern)  &&  !subgraph.isPattern;

      if (edge.to == '') return;
      nodes[edge.to] = true;

      negateMatches[edge.to] = !_.isUndefined(subgraph.isPattern) && !_.isNull(subgraph.isPattern)  &&  !subgraph.isPattern;
    });
  });

  var newConjunctions = 
    Object.keys(nodes)
    .filter(filterNodeLabel)
    .map(function(nodeLabel){
      var obj = {};
      if (nodeLabel.includes('.')) {
        nodeLabel = nodeLabel.replace(/\./g, '__');
      }
      
      if (negateMatches[nodeLabel]) {
        obj[nodeLabel] = {$exists: false};
      } else {
        obj[nodeLabel] = {$exists: true};
      }
     
      return obj;
    });
    if (selector['$and']) {
      selector['$and'] = selector['$and'].concat(newConjunctions);
    } else {
      selector['$and'] = newConjunctions;
    }

  return selector;
}

var filterNodeLabel = function(nodeLabel) {
  return nodeLabel != 'UNKNOWN' && nodeLabel != '<a>' && nodeLabel != '<r>' && !nodeLabel.includes("pseudo");
}

var constructSelectorToFilterBaggedPatterns = function(selector) {
  var disjunct = [];

  var bagsToSubgraphs = {};
  Subgraphs.find({ 'bags': { '$exists': true, '$ne': [] } }).forEach(function (subgraph) {
    var subgraphID = subgraph._id;
    var subgraphBag = subgraph.bags;

    if (bagsToSubgraphs[subgraphBag] == undefined) {
      bagsToSubgraphs[subgraphBag] = [];
    }
    bagsToSubgraphs[subgraphBag].push(subgraphID);
  });

  Object.keys(bagsToSubgraphs) // iterate over the bags
    .forEach(function (bag) {
      var subgraphIds = bagsToSubgraphs[bag];
      var subgraphs = Subgraphs.find({ _id: { '$in': subgraphIds } }).fetch();
      var subgraphsSelector = computeSelector(subgraphs);
      disjunct.push(subgraphsSelector);
    });

  if (selector['$and'] != undefined) {
    if (disjunct.length > 0) {
      selector['$and'].push({ '$nor': disjunct });
    }
  } else {
    if (disjunct.length > 0) {
      selector['$and'] = [{ '$nor': disjunct }];
    }
  }
  return selector;
}

function computeSelectorFromSkeleton(skeleton) {
  if (skeleton == undefined || Object.keys(skeleton).length == 0) {
    return {};
  }
  // console.log(skeleton);

  // from the skeleton, obtain the nodes that are checked
  var selector = {};
  var subgraphNodeLabels = 
    Object.keys(skeleton)
    .filter(function(nodeLabel) {
      var checked = skeleton[nodeLabel].checked;
      return checked;
    })
    .map(function(nodeLabel) {
      return nodeLabel;
    });
  var newConjunctions = 
    subgraphNodeLabels.map(function(nodeLabel){
      var obj = {};

      var skeletonPart = skeleton[nodeLabel];
      var negateMatch = skeletonPart.matchStatus == 'misuse';

        
      if (nodeLabel.includes('.')) {
        nodeLabel = nodeLabel.replace(/\./g, '__');
      }
      // console.log('building new conjunctions', nodeLabel);
      if (!negateMatch) {
        obj[nodeLabel] = {$exists: true};
      } else {
        obj[nodeLabel] = {$exists: false};
      }
      
      return obj;
    });
  // console.log('newConjunctions');
  // console.log(Object.keys(newConjunctions));
    
  if (selector['$and']) {
    selector['$and'] = selector['$and'].concat(newConjunctions);
  } else {
    selector['$and'] = newConjunctions;
  }

  // add packages and subtypes
  var packages = skeleton['packages'];
  var subtypes = skeleton['subtypes'];

  if (packages && Object.keys(packages).length > 0) {
    var newConjunctions =
    Object.keys(packages).map(function(pkg) {
        var obj = {};
        // obj['pkg'] = {'$in': [pkg]};
        // match regular expression in meteor
        obj['pkg'] = { '$regex': pkg, '$options': 'i' };

        return obj;
      });
    if (selector['$and']) {
      selector['$and'] = selector['$and'].concat(newConjunctions);
    } else {
      selector['$and'] = newConjunctions;
    }
  }
  if (subtypes && Object.keys(subtypes).length > 0) {
    var newConjunctions = {'ancestry' : 
      { '$regex': Object.keys(subtypes)[0], '$options': 'i' }
    };
    if (selector['$and']) {
      selector['$and'] = selector['$and'].concat(newConjunctions);
    } else {
      selector['$and'] = newConjunctions;
    }
  }


  
  if (selector['$and'] && selector['$and'].length == 0) {
    delete selector['$and'] ;
  }
  return selector;
}

var buildSkeleton = function(){

  var subgraphs = Subgraphs.find({ '$and' : 
  [
    {'discriminative': true},  
    {'hidden': {'$ne': true}},
    {'$or': [{ 'bags': { '$exists': false } }, { 'bags': { $eq: null } }]}
  ]
  }).fetch();

  // find max pattern number
  var maxPatternNumber = -1;
  subgraphs.forEach(function(subgraph) {
    if (subgraph.patternNumber > maxPatternNumber) {
      maxPatternNumber = subgraph.patternNumber;
    }
  });

  // also check Containment
  var containments = Containment.find({}).fetch();
  console.log('containments', containments);
  containments.forEach(function(containment) {
    if (containment.patternNumber > maxPatternNumber) {
      maxPatternNumber = containment.patternNumber;
    }
  });


  var multiSkeleton = [];
  for (var i = 0; i <= maxPatternNumber; i++) {
    console.log('building skeleton for pattern ' + i);
    multiSkeleton.push(buildSkeletonForI(i));
  }
  return multiSkeleton;
}

var buildSkeletonForI = function(subgraph_i){
  
  // if (Session.get('skeleton')[0] && Object.keys(Session.get('skeleton')[0]).length > 0) {
  //   return;
  // }

  var nodeContainedInSubgraph = {};
  
  var nodeContainedInCorrectSubgraph = {};
  var nodeContainedInMisuseSubgraph = {};

  var mustMatchEdges = {};

  var nodes = {};
  Subgraphs.find( { '$or' : [{'$and': [{discriminative: true, patternNumber: subgraph_i, hidden: {'$ne' : true }}]} ] }).forEach(function(subgraph) {
    
    subgraph.edges.forEach(function(edge) {
      
        
      if (filterNodeLabel(edge.from)) {
        nodes[edge.from] = true;

        if (!nodeContainedInSubgraph[edge.from]) {
          nodeContainedInSubgraph[edge.from] = [];
        }
        nodeContainedInSubgraph[edge.from].push(subgraph._id);
        if (subgraph.labelled) {
          // console.log('subgraph labelled for ed.gefrom-> ' + edge.from);
          if (subgraph.isPattern) {
            if (!nodeContainedInCorrectSubgraph[edge.from]) {
              nodeContainedInCorrectSubgraph[edge.from] = [];
            }
            nodeContainedInCorrectSubgraph[edge.from].push(subgraph._id);
          } else {
            if (!nodeContainedInMisuseSubgraph[edge.from]) {
              nodeContainedInMisuseSubgraph[edge.from] = [];
            }
            nodeContainedInMisuseSubgraph[edge.from].push(subgraph._id);
          }
        }
      }

      if (filterNodeLabel(edge.to) && edge.to != '') {
        nodes[edge.to] = true;
        if (!nodeContainedInSubgraph[edge.to]) {
          nodeContainedInSubgraph[edge.to] = [];
        }

        nodeContainedInSubgraph[edge.to].push(subgraph._id);

        if (subgraph.labelled) {
          // console.log('subgraph labelled for ed.geto -> ' + edge.to);
          if (subgraph.isPattern) {
            if (!nodeContainedInCorrectSubgraph[edge.to]) {
              nodeContainedInCorrectSubgraph[edge.to] = [];
            }

            nodeContainedInCorrectSubgraph[edge.to].push(subgraph._id);
          } else {
            if (!nodeContainedInMisuseSubgraph[edge.to]) {
              nodeContainedInMisuseSubgraph[edge.to] = [];
            }
            nodeContainedInMisuseSubgraph[edge.to].push(subgraph._id);
          }
        }
      }

      if (edge.from && edge.to) {
        var edgeKey = edge.from + ' -> ' + edge.to + ' ' + edge.label + '';
        // if (!mustMatchEdges[edgeKey]) {
          mustMatchEdges[edgeKey] = true;
        // }
        
      }
    });
  });

  // console.log('nodeContainedInCorrectSubgraph');
  // console.log(nodeContainedInCorrectSubgraph);
  // console.log('nodeContainedInMisuseSubgraph');
  // console.log(nodeContainedInMisuseSubgraph);
  var skeleton = {};  

  Object.keys(nodes).forEach(function(nodeLabel){
    var subgraphIds = [];
    if (nodeContainedInCorrectSubgraph[nodeLabel]) {
      subgraphIds.push( ...nodeContainedInCorrectSubgraph[nodeLabel]);
    }
    if (nodeContainedInMisuseSubgraph[nodeLabel]) {
      subgraphIds.push( ...nodeContainedInMisuseSubgraph[nodeLabel]);
    }


    var matchStatus;
    if (nodeContainedInCorrectSubgraph[nodeLabel] && nodeContainedInCorrectSubgraph[nodeLabel].length > 0) {
      if ( nodeContainedInMisuseSubgraph[nodeLabel] && nodeContainedInMisuseSubgraph[nodeLabel].length > 0) {
        matchStatus = 'mixed';
      } else {
        matchStatus = 'correct';
      }
      
    } else if (nodeContainedInMisuseSubgraph[nodeLabel] && nodeContainedInMisuseSubgraph[nodeLabel].length > 0) {
      if ( nodeContainedInCorrectSubgraph[nodeLabel] && nodeContainedInCorrectSubgraph[nodeLabel].length > 0) {
        matchStatus = 'mixed';
      }
      else {
        matchStatus = 'misuse';
      }

    }
   
    skeleton[nodeLabel] = {
      'text': nodeLabel.replace(/\./g, '__'),
      'checked': matchStatus === 'correct' || matchStatus === 'misuse', 
      'matchStatus': matchStatus,
      'subgraphIds': subgraphIds,
      'allSubgraphs': nodeContainedInSubgraph[nodeLabel]
    };
  });

  // pairwise constraints
  Object.keys(mustMatchEdges).forEach(function(edgeKey) {
    skeleton[edgeKey] = {
      'text': edgeKey,
      'checked': true,
      'matchStatus': 'correct',
    }
  });


  // packages and subtypes and names
  var packages = {};
  var subtypes = {};
  var classnames = {};
  Containment.find({patternNumber: subgraph_i}).forEach(function(containment) {
    if (containment.pkg && containment.selected) {
      packages[containment.pkg] = true;
    }
    if (containment.type && containment.selected) {
      subtypes[containment.type] = true;
    }
    if (containment.name && containment.selected) {
      classnames[containment.name] = true;
    }
  });

  skeleton['packages'] = packages;
  skeleton['subtypes'] = subtypes;
  skeleton['classnames'] = classnames;

// 
  // console.log('running buildSkeleton completed!' )
  // console.log(skeleton);

  // if (Object.keys(skeleton).length > 0) {
    // console.log('running buildSkeleton completed!' + skeleton)

  return skeleton;
  // }

}

var filterByViewAndKeyword = function(skeleton, viewType, keyword){
  // account for the view type
  
  if (viewType === 'all') {
    // default behavior
    var selector = constructSelectorToFilterBaggedPatterns({});
    
  } else if (viewType === 'matching') {
    if (_.isEmpty(skeleton)){
      return {};
    }
    // apply the skeleton selector
    var selector = computeSelectorFromSkeleton(skeleton);
    selector = constructSelectorToFilterBaggedPatterns(selector);
    
  } else if (viewType === 'unlabelled') {
    // select examples not labelled
    var selector = {'label': {'$nin': [ 'positive', 'negative']}};
    selector = constructSelectorToFilterBaggedPatterns(selector);
    
    
  } else if (viewType === 'labelled') {
    // select examples not labelled
    var selector = {'label': {'$in': [ 'positive', 'negative']}};
    selector = constructSelectorToFilterBaggedPatterns(selector);
    
    
    
  }  else if (viewType === 'confused') {
    if (_.isEmpty(skeleton)){
      return {};
    }
    
    // select examples labelled, but mismatching the skeleton
    // 1. select examples matching the skeleton, but are negative
    // 2. select examples not matching the skeleton, but are positive
    var selector = computeSelectorFromSkeleton(skeleton);
    selector['$and'] = [{'label': 'negative'}];

    selector = constructSelectorToFilterBaggedPatterns(selector);


  } else if ( viewType === 'not-matching') {
    if (_.isEmpty(skeleton)){
      return {};
    }
    // select examples not matching the skeleton
    var selector = {'$and': [{'label': 'positive'}, {'$nor': computeSelectorFromSkeleton(skeleton)['$and']}]};
    selector = constructSelectorToFilterBaggedPatterns(selector);
    
  }

  if (keyword) {  
    const regex = new RegExp(keyword, 'i');
    const query = { codeElements: regex };

    if (!selector['$and']){
      selector['$and'] = [];
    }
    selector['$and'].push(query);
  }

  return selector;
}
var fs = Npm.require('fs');




var abstractString = function(string) {
  // split by word boundary and by camel case
  var words = string.split(/(?=[A-Z])|(?=[0-9])|(?=[^A-Za-z0-9])/g);

  words = words.filter(function(word) {
    return word != '*' && word != '.';
  });

  // return collection of abstracted strings
  // each abstracted string is the string where a word is abstracted into wildcard
  var abstractedStrings = [];
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (word.length == 0) {
      continue;
    }
    var abstractedString = words.slice();
    abstractedString[i] = '.*';
    abstractedStrings.push(abstractedString.join(''));
  }
  return abstractedStrings;

}


var shellOutToMineSubgraphs = function(graphId, labels, elementIdToGraphId, focalNode, nodesToInclude, eraseOld, showImmediately) {
  shellOutToMineSubgraphsMultiple([graphId], labels, elementIdToGraphId, focalNode, nodesToInclude, eraseOld, showImmediately);
}

var shellOutToMineSubgraphsMultiple = function(graphIds, labels, elementIdToGraphId, focalNode, nodesToInclude, eraseOld, showImmediately) {
  
  spawn = Npm.require('child_process').spawn;

  // this elementIdToGraphId is a map that controls which examples are inspected by the subgraph miner
  const encoded = Buffer.from(JSON.stringify(elementIdToGraphId)).toString('base64');

  var request_number = request_counter;
  // this also runs the code that mines the subgraphs
  
  console.log('spawining child process for mining subgraphs. target graph ids', graphIds, labels);
  
  // join graphIds by comma
  var joinedGraphId = graphIds.join(',');
  nodesToInclude = nodesToInclude ? nodesToInclude.join(',') : '---dummy---';
  
  console.log('python3 ' + appPath + "update_labels.py " + joinedGraphId + " " + labels + " " + encoded + " " + experiment_id + " " + request_counter + " " + warningType + " " + focalNode + " " + nodesToInclude);
  command = spawn('python3',[appPath + "update_labels.py", joinedGraphId, labels, encoded, experiment_id, request_counter, warningType, focalNode, nodesToInclude]);

  console.log('request_counter = ' + request_counter);
  // Session.set('request_counter', request_counter + 1);
  request_counter += 1;

  command.stdout.on('data',  function (data) {
    // console.log('[shellOutToMineSubgraphsMultiple] stdout: ' + data);
  });

  command.stderr.on('data', function (data) {
      // console.log('[shellOutToMineSubgraphsMultiple] stderr: ' + data);
  });

  command.on('exit', Meteor.bindEnvironment(function (code) {
    console.log('child process exited with code ' + code);
    shellOutToReadSubgraphs(request_number, focalNode, eraseOld, showImmediately);

    // shellOutToMinePatternsMultiple(graphIds, labels, elementIdToGraphId);
  }));
  // shellOutToMinePatternsMultiple(graphIds, labels, elementIdToGraphId);
}




var shellOutToCreateNewExample = function(text, label, dataset, view, keyword) {
  // write text to file 
  console.log('=====');
  console.log(text);
  console.log('=====');

  var fullProgram = `public class NewExampleUse {`
  fullProgram += text;
  fullProgram += `\n}`;

  // write to file
  
  fs.writeFile(projectPath + '/code/graphs/newJavaProgram.java', fullProgram, function(err) {
    if (err) {
      return console.log(err);
    } else {
      console.log("The file was saved!");
    }
  });


  var miningLabel = label === 'positive' ? '+' : '-';

  spawn = Npm.require('child_process').spawn;
  console.log('spawining child process for creating new example', text, miningLabel);

  command = spawn('java',[ '-jar', appPath + "misc_scripts/graph_convertor.jar" ,
    warningType, projectPath + "/code/graphs/", projectPath + "/code/graphs/", label]);

  command.stdout.on('data',  function (data) {
      console.log('[shellOutToCreateNewExample stdout: ' + data);
  });
  command.stderr.on('data', function (data) {
    console.log('[shellOutToCreateNewExample] stderr: ' + data);
  });

  command.on('exit', Meteor.bindEnvironment(function (code) {
    console.log('child process exited with code ' + code);

    // read the file,projectPath +  /code/graphs/java.security.MessageDigest__digest_test_formatted.txt, and find largest graph id
    var graphId = 0;
    var file = fs.readFileSync(projectPath + '/code/graphs/' + warningType + '_formatted.txt', 'utf8');
    var lines = file.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.startsWith('t')) {
        graphId += 1;;
      }
    }
    graphId += 1;

    // next, read java.security.MessageDigest__digest_test_elementpositions.json
    var elementPositions = JSON.parse(fs.readFileSync(projectPath + '/code/graphs/' + warningType + '_test_elementpositions.json', 'utf8'));
    
    var key = Object.keys(elementPositions)[0];

    var one_element_position = EJSON.parse(elementPositions[key]);

    var expressionStarts = one_element_position['expressionStart'];
    var expressionEnds = one_element_position['expressionEnd'];

    var programElementToExpression = {};
  
    _.each(expressionStarts, function(start, startkey){
      var end = expressionEnds[startkey];

      if (startkey.includes('.')) {
        startkey = startkey.replace(/\./g, '__');
      }
      programElementToExpression[startkey] = {};
      programElementToExpression[startkey]['expressionStart'] = start;
      programElementToExpression[startkey]['expressionEnd'] = end;
    });
    programElementToExpression['codeElements'] = Object.keys(expressionStarts);
    
    
    // update the database
    var newExampleId = Examples.find().count() + 1;
    var newExample = {
      exampleID: newExampleId,
      text: text,
      label: label,
      dataset: dataset,
      graphId: graphId,
      codeElements : Object.keys(expressionStarts),
      rawCode : text
    };
    // extend newExample with programElementToExpression
    newExample = _.extend(newExample, programElementToExpression);
    console.log('newExample = ' + JSON.stringify(newExample));
    
    Examples.insert(newExample, function (error, result) {
      console.log('error when inserting new example---->' + error);
    });


    // trigger code to mine subgraphs
    var elementIdToGraphId = {};
    // exclude the examples that do not match the current view
    var selector = filterByViewAndKeyword(buildSkeleton(), view, keyword);
    Examples.find(selector).forEach(function (example) {
      elementIdToGraphId[example.exampleID] = example.graphId;
    });

    // shellOutToMineSubgraphs(-1, null, elementIdToGraphId, false, "---dummy---", false);

    }
  ));
}

var shellOutToCreateNewExampleFromRepo = function(path, dataset, view, keyword) {

  spawn = Npm.require('child_process').spawn;
  if (path.includes('github.com')) {
    // clone the repository into a temporary directory
    var tempDir = projectPath + '/code/temp/';
    var tempPath = tempDir + path.split('/').pop();
    console.log('tempPath = ' + tempPath);
    var command = spawn('git', ['clone', path, tempPath]);
    command.stdout.on('data',  function (data) {
        console.log('[shellOutToCreateNewExampleFromRepo stdout: ' + data);
    });
    command.stderr.on('data', function (data) {
      console.log('[shellOutToCreateNewExampleFromRepo] stderr: ' + data);
    });
    command.on('exit', Meteor.bindEnvironment(function (code) {
      console.log('child process exited with code ' + code);
      shellOutToCreateNewExampleFromRepo(tempPath, dataset, view, keyword);
    }));

    return;
  }


  
  console.log('spawining child process for applying patterns on new examples', [ '-jar', appPath + "misc_scripts/multiple_graph_convertor.jar" ,
  warningType, path, projectPath + "/code/graphs/", ]);

  var command = spawn('java',[ '-jar', appPath + "misc_scripts/multiple_graph_convertor.jar" ,
  warningType, path, projectPath + "/code/graphs/", ]);


  command.stdout.on('data',  function (data) {
    console.log('stdout: ' + data);
  });
  command.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  command.on('exit', Meteor.bindEnvironment(function (code) {

    try {
    console.log('child process exited with code ' + code);

    // read the file,projectPath +  /code/graphs/java.security.MessageDigest__digest_test_formatted.txt, and find largest graph id
    var graphId = 0;

    // looks like we're be succesful.
    // clear old examples
    Examples.remove({dataset: dataset});
    request_counter = 1;
    // clear non discriminative subgraphs
    var a = Subgraphs.remove({'$and': [{'discriminative': {'$ne': true}}, { 'labelled': {'$ne': true} }, { '$or': [ {'bag' : {'$exists': false}}, {'bag': {$eq: null}}  ]}]});
    

    console.log(projectPath + '/code/graphs/' + warningType + '_elementpositions.json')
    var elementPositions = JSON.parse(fs.readFileSync(projectPath + '/code/graphs/' + warningType + '_elementpositions.json', 'utf8'));
    // Object.keys(elementPositions).forEach(function(key){
      // for loop to iterate the keys of ElementPositions
    for (var i = 0; i < Object.keys(elementPositions).length; i++) {
      var key = Object.keys(elementPositions)[i];
      console.log('processing', key, elementPositions[key]);
    
      var one_element_position = EJSON.parse(elementPositions[key]);

      var expressionStarts = one_element_position['expressionStart'];
      var expressionEnds = one_element_position['expressionEnd'];

      var programElementToExpression = {};
    
      _.each(expressionStarts, function(start, startkey){
        var end = expressionEnds[startkey];

        if (startkey.includes('.')) {
          startkey = startkey.replace(/\./g, '__');
        }
        programElementToExpression[startkey] = {};
        programElementToExpression[startkey]['expressionStart'] = start;
        programElementToExpression[startkey]['expressionEnd'] = end;
      });
      programElementToExpression['codeElements'] = Object.keys(expressionStarts);
      
    
      // update the database
      graphId += 1;
      var newExampleId = i;
      var newExample = {
        exampleID: newExampleId,
        text: one_element_position['rawCode'],
        dataset: dataset,
        graphId: graphId,
        codeElements : Object.keys(expressionStarts),
        rawCode : one_element_position['rawCode'],
        rawCodeLineNumber : one_element_position['rawCodeLineNumbers'],
      };
      // extend newExample with programElementToExpression
      newExample = _.extend(newExample, programElementToExpression);
      console.log('newExample = ' + newExampleId + ' : ' + JSON.stringify(newExample));
      
      Examples.insert(newExample, function (error, result) {
        console.log('error when inserting new example---->' + error);
      });
    }


    // trigger code to mine subgraphs
    var elementIdToGraphId = {};
    // exclude the examples that do not match the current view
    var selector = filterByViewAndKeyword(buildSkeleton(), view, keyword);
    Examples.find(selector).forEach(function (example) {
      elementIdToGraphId[example.exampleID] = example.graphId;
    });

    shellOutToMineSubgraphs(-1, null, elementIdToGraphId, "---dummy----", [], false, false);
  } catch (e) {
    console.log('error caught! when connecting to repo', e);

  }
    }
  ));
}

function makeid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

var inferPatterns = function() {

  console.log('[inferPattern] running infer pattern');
  var subgraphs = [];

  var patternNumber = 0;
  var examplesAlreadyMatched = [];

  var debugId = makeid(4);

  // fetch by insertion order


  Subgraphs.find({discriminative: true, hidden: true}, {sort: {insertionOrder: 1}})
  .fetch().forEach(function (oneSubgraph) {
    

      var matchAnyNewExample = false;
      var numMatches = 0;

      // check if the pattern matches any new example
      console.log('[inferPattern]', oneSubgraph)
      var selector = computeSelector([oneSubgraph]);
      if (!selector['$and']) {
        return;
      }
      selector['label'] = 'positive';

      
      try {
        var examplesMatch = Examples.find(selector).fetch();
        console.log('[inferPatterns] selector',JSON.stringify(selector), 'match', examplesMatch.length);
        
        examplesMatch.forEach(function (example) {
          var exampleID = example.exampleID;
          numMatches += 1;

          if (examplesAlreadyMatched.indexOf(exampleID) == -1) {
            console.log('[inferPatterns] debug=' + debugId + " subgraph="  + oneSubgraph.rawText + ' match example ' + exampleID + '  with ' + example.label);
            matchAnyNewExample = true;
            examplesAlreadyMatched.push(exampleID);
          }
          
        });
      
        if (numMatches >= 1 && matchAnyNewExample) {
          oneSubgraph['patternNumber'] = patternNumber;
          subgraphs.push(oneSubgraph);
          console.log('adding pattern ' + patternNumber + " because numMatches=" + numMatches + " matchAnyNewExample=" + matchAnyNewExample + "" )

          patternNumber += 1;
        } else{



          // console.log('not adding pattern ' + JSON.stringify(oneSubgraph) + " because numMatches=" + numMatches + " matchAnyNewExample=" + matchAnyNewExample + " and showBecauseOfExplanation=" + showBecauseOfExplanation )
        }
      } catch (e) {
        console.log('error when computing selector for pattern', e);
      }
    
  });
  
// 
  if (subgraphs.length == 0) {
    console.log('no suitable pattern found...')
    return;
  }

  var debugStr = '';
  subgraphs.forEach(function (subgraph) {
    debugStr += subgraph.rawText + ' ';
  });

  console.log('[inferPattern] debugId=' + debugId + ' will set pattern number for ' + debugStr);
  subgraphs.forEach(function (subgraph) {

    Subgraphs.update({_id: subgraph._id}, {$set: {patternNumber: subgraph['patternNumber'], hidden: false, labelled: true, isPattern: true}});

    // create new nodes for each edge's source and target
    var nodes = [];
    
    console.log('infer patterns:: one subgraph  = ' + subgraph.rawText);

    var edges = subgraph.edges;
    edges.forEach(function (edge) {
      var source = edge.from;
      var target = edge.to;
      
      console.log('infer patterns:: one subgraph edge = ' + edge.rawText);

      var adjlist = {};
      var edges = [];
      if (source) {
        source = source.replace(/\./g, '__');
        adjlist[source] = [];
        adjlist[source].push({to: '', label: ''});
        edges.push({from: source, to: '', label: '', rawText:edge.from});
        var sourceNode = { rawText: source, edges: edges, adjlist: adjlist, discriminative: true, labelled:true, alternative:false, initiallyFrequent:false, isPattern: true, patternNumber: subgraph.patternNumber, debug_added_from: 'aaaa', debug_request_number: subgraph.request_number}

        nodes.push(sourceNode);

        console.log('infer patterns:: one subgraph edge source = ' + source);
      }

      if (target) {
        target = target.replace(/\./g, '__');
        adjlist[target] = [];
        adjlist[target].push({to: '', label: ''});
        edges.push({from: target, to: '', label: '', rawText:edge.to});
        var targetNode = { rawText: target, edges: edges, adjlist: adjlist, discriminative: true, labelled:true, alternative:false, initiallyFrequent:false, isPattern: true, patternNumber: subgraph.patternNumber, debug_added_from: 'aaaa', debug_request_number: subgraph.request_number}


        nodes.push(targetNode);

        console.log('infer patterns:: one subgraph edge target = ' + target);
      }


    });
  

    nodes.forEach(function (node) {
      Subgraphs.insert(node);
    }); 
  });
  // hide the query examples
  // Examples.update({query: true}, {$set: {query: 'false'}}, {multi : true});
  
  console.log('infer patterns!');


  
  var allExamples = Examples.find({'graphId' : { '$exists' : true }, 'label': {'$in': [ 'positive', 'negative']} } ).fetch()
    .map(function(example) { return example.exampleID; });

  // take allExamples - examplesAlreadyMatched
  var examplesNotMatched = allExamples.filter(function(exampleId) { return !examplesAlreadyMatched.includes(exampleId); });

  if (examplesNotMatched.length == 0) {
    return;
  }
  console.log('examplesNotMatched', JSON.stringify(examplesNotMatched));

  

}


// var shellOutToSelectClusters = function (

Meteor.methods({
  'updateParticipantID' ({participantID}) {
    console.log('change participant id ' + subjectNum + ' to ' + participantID);
    subjectNum = participantID;
  },
  'createNewExample'({text, label, dataset, view, keyword}) {

    shellOutToCreateNewExample(text, label, dataset, view, keyword);
  },
  'connectToRepo'({path, dataset, view, keyword}) {
    try{
      console.log('connecting to repo', path);
    shellOutToCreateNewExampleFromRepo(path, dataset, view, keyword);
    console.log('[done] connecting to repo', path);
    } catch (e) {
      console.log('error when connecting to repo', e);
    }
  },
  'updateLabels'({ exampleId, methodName, labels, view, keyword, focalNode, matchSink, triggerMining}) {
    // console.log('ruleName inside updateLabels', ruleName);
    console.log('got the labels ' + exampleId + '  ' + methodName + ' ' + labels + ' ' + view + ' keyword:' + keyword + 'focalNode = ' + focalNode + " matchSink:" + matchSink);
    

    var a = Examples.update({exampleID: parseInt(exampleId)}, {$set: {label: labels}}, function (error, result) {
        if (error) {
          console.log('error when updating Examples with label---->' + error);
          return;
        } 
    

    // write to lp file
    var lp_labels = '';
    // for labelled examples
    Examples.find({label: {'$in': [ 'positive', 'negative']} }).forEach(function (example) {
      if (example.label == 'positive') {
        lp_labels += 'pos(' + example.exampleID + ').\n'
      } else {
        lp_labels += 'neg(' + example.exampleID + ').\n'
      }
    });

    var allRulePackages = [];
    var allRuleSubtypes = [];
    var allRuleNames = [];
    var allRuleReturnTypes = [];
    var allRuleFieldsUsed = [];

    var allRuleRawOutput = [];

    // append to file
    if (triggerMining) {
      fsPromises.writeFile(projectPath + '/code/lp/' + warningType + '_labels.lp', lp_labels)
      .then(() => {
        console.log('successfully wrote to ' + projectPath + '/code/lp/' + warningType + '_labels.lp');
      

      }).then(() => {

        // run clingo
        let args = [projectPath + '/code/lp/' + warningType + '_labels.lp', projectPath + '/code/lp/background.lp']
        // args.push(projectPath + '/code/lp/query_examples.lp');
        
        args.push(projectPath + '/code/lp/frozen_rules.lp');
        args.push(projectPath + '/code/lp/rules2.lp');
        args.push(projectPath + '/code/lp/selected_code_rules.lp');

      
        console.log('running clingo with args', args.join(' '));
        var command = exec('clingo --time-limit=15 ' + args.join(' '), Meteor.bindEnvironment(function (error, stdout, stderr) {
          if (error) {
            console.error(`exec error (usually this can be ignored. This just means that stderr wasn't blank): ${error}`);
            
          }
          
            // console.log('stdout: ' + stdout);
            // console.log(typeof data)
    
            const maxNumberOfRules = 5;
            // parse the output
            // split by newline
            var lines = stdout.toString().split('\n');
            var numRuleInsertions = 0;
    
            for (var i = 0; i < lines.length; i++) {
    
              // TODO for now, include only the last answer
              console.log(lines[i]);

              
    
              if (String(lines[i]).includes('Answer:')) {
                // reset
                allRulePackages = [];
                allRuleSubtypes = [];
                allRuleNames = [];
                allRuleReturnTypes = [];
                allRuleFieldsUsed = [];
                allRuleRawOutput = [];
                allRuleCode = [];

                for (var ruleIndex = 0; ruleIndex < maxNumberOfRules; ruleIndex ++) {

                  allRulePackages.push([])
                  allRuleSubtypes.push([])
                  allRuleNames.push([])
                  allRuleReturnTypes.push([])
                  allRuleFieldsUsed.push([])
                  allRuleRawOutput.push([])
                  allRuleCode.push([])
                }
              }
    

    
              // extract stuff in rule_contains(...)
              for (var ruleIndex = 0; ruleIndex < maxNumberOfRules; ruleIndex ++) {

                // let regex = /rule_contains\(([^)]+)\)/g;
                // construct regex using rule_contains and ruleIndex
                let regex = new RegExp(`rule_contains${ruleIndex}\\(([^\\)]+)\\)`, 'g');
                let matches = String(lines[i]).match(regex);

                if (matches) {
                  console.log('====')
                  // console.log('matches', matches);

                  matches.forEach(match => {
                      // Extract the content within the parentheses
                      let extracted = match.match(/\(([^)]+)\)/)[1];
                      console.log(extracted);
                      // split on the first _
                      var extractedSplit = extracted.split('_');
                      var type = extractedSplit[0];
                      var id = extracted.substring(type.length + 1);
      
                      id = id.replace('__dotstar__', '.*').replace('__slashw_plus__', '\\w+').replace(/__/g, '.').replace('_lb', '[').replace('_rb', ']').replace('_lt', '<').replace('_gt', '>');
      
                      console.log(type + " : " + id);
      
                      if (type == 'package') {
                        allRulePackages[ruleIndex].push(id);
                      } else if (type == 'subtype') {
                        allRuleSubtypes[ruleIndex].push(id);
                      } else if (type == 'class') {
                        allRuleNames[ruleIndex].push(id);
                      } else if (type == 'ret') {
                        allRuleReturnTypes[ruleIndex].push(id);
                      } else if (type == 'field') {
                        allRuleFieldsUsed[ruleIndex].push(id);
                      } else if (type == 'code') {
                        // unescape from ILP
                        code = id.replace(/_dot_/g, '.').replace(/_slash_/g, '/').replace(/_lt/g, '<').replace(/_gt/g, '>').replace(/__s__/g, ' ').replace(/'_colon_'/, ':').replace(/__amp__/g, '%').replace(/__plus__/g, '+').replace(/_lp/g, '(').replace(/_rp/g, ')');
                        allRuleCode[ruleIndex].push(code);
                      }

                      allRuleRawOutput[ruleIndex].push(extracted);
      
                  });

                  // save the output predicates
                  matches.forEach(match => {

                  });
                }
              }
            }
    
            console.log('-===')
            console.log('allRuleSubtypes', allRuleSubtypes);
            console.log(allRulePackages);
            console.log(allRuleNames);
            console.log(allRuleReturnTypes);
            console.log(allRuleFieldsUsed);
            console.log(allRuleRawOutput);
            console.log('code:')
            console.log(allRuleCode);
            console.log('-===')

    
            // promisify
            var summarySubtypes = new Promise((resolve, reject) => resolve(allRuleSubtypes));
            var summaryPackages = new Promise((resolve, reject) => resolve(allRulePackages));
            var summaryNames =  new Promise((resolve, reject) => resolve(allRuleNames));
            var summaryReturnTypes =  new Promise((resolve, reject) => resolve(allRuleReturnTypes));
            var summaryFieldsUsed = new Promise((resolve, reject) => resolve(allRuleFieldsUsed));
            var summaryCode = new Promise((resolve, reject) => resolve(allRuleCode));

            var rawOutput = new Promise((resolve, reject) => resolve(allRuleRawOutput));
            
            Containment.remove({});
            // clear Refinements if frozen does not exist
            Refinements.remove({frozen: {$exists: false}});

            // insert
            insertRule(summaryNames, summaryPackages, summarySubtypes, summaryReturnTypes, summaryFieldsUsed, summaryCode, rawOutput);
            numRuleInsertions = _.filter(allRuleRawOutput, function (output) { return output.length > 0;}).length;

         
            // introduce more choice rules if all allRuleRawOutput is not empty
            if (numRuleInsertions >= maxNumRuleSeenSoFar) {
             // introduce more choice rules
             console.log('[updateLabels] introduce more choice rules', maxNumRuleSeenSoFar, numRuleInsertions);
             introduceMoreChoiceRules(maxNumRuleSeenSoFar);
             maxNumRuleSeenSoFar = numRuleInsertions + 1;
           }
         

           
          
        }));
       

        
      });
      
      }
    });

    

    // write to file

    var dir = path.resolve('.').split('.meteor')[0];
    var filename = dir + '_' + subjectNum + '_' + warningShortName + '_record.txt';
    
    console.log(filename);
    fs.appendFile(filename, '' +"\n", function(err) {
      if(err) {
        return console.log(err);
      }
      console.log("The file was appended to!");
    });
    

    if (!triggerMining) {

      return;
    }
    
   

    // updateLabels(view, matchSink, exampleId, methodName, focalNode, labels);

    

    // console.log('[update label] Contaiment count = ' + Containment.find({}).count());
  },
 
  'updatePackage'({packageId, selected}) {
    console.log('[updatePackage] ' + packageId + ' ' + selected);
    // unset all other packages
    Containment.update({pkg: {$exists:true, $ne: packageId}}, {$set: {selected: false}}, {multi: true});
    if (selected) {
      // set selected to true
      Containment.update({_id: packageId}, {$set: {selected: true}});
    } else {
      Containment.update({_id: packageId}, {$set: {selected: false}});

    }
  },
  'updateClassname' ({classnameId, selected}) {
    console.log('[updateClassname] ' + classnameId + ' ' + selected);
    // unset all other classnames
    Containment.update({name: {$exists:true, $ne: classnameId}}, {$set: {selected: false}}, {multi: true});
    if (selected) {
      // set selected to true
      Containment.update({_id: classnameId}, {$set: {selected: true}});
    } else {
      Containment.update({_id: classnameId}, {$set: {selected: false}});
    }
  },
  'updateSubtype'({subtypeId, selected}) {
    console.log('[updateSubtype] ' + subtypeId + ' ' + selected);
    // unset all other subtypes
    Containment.update({type: {$exists:true, $ne: subtypeId}}, {$set: {selected: false}}, {multi: true});
    if (selected) {
      Containment.update({_id: subtypeId}, {$set: {selected: true}});
    } else {
      Containment.update({_id: subtypeId}, {$set: {selected: false}});
    }
  },
  'updateRuleName' ({ruleNumber, ruleName}) {
    console.log('[updateRuleName] ' + ruleNumber + ' ' + ruleName);
    Containment.update({patternNumber: parseInt(ruleNumber)}, {$set: {ruleName: ruleName}});
    
    freezePredicatesInRule(ruleNumber);
    saveRuleNameToDb(ruleNumber, ruleName);

    // freeze the refinment
    Refinements.update({ ruleNumber: ruleNumber }, { $set: {frozen: true }});

    // freeze the rule
    Containment.update({ patternNumber: ruleNumber }, { $set: {frozen: true }});
  },
  'inspectExamples' ({filterType, argument}) {
    // reset all query=true
    Examples.update({}, {$set: {query: false}} , {multi: true}, function (error, result) {
    });
    console.log('[inspectExamples] filterType=', filterType);


    var selector;
    if (filterType == 'unmatching') {
      // selector = {'$and': [{'$nor': []}]};

      // var skeletons = buildSkeleton();

      // console.log('[inspectExamples] skeletons', skeletons)
      // if (skeletons.length == 0) {
      //   selector = {};
      // } 

      // if (skeletons.length >0) {
      //   // match only unlabelled examples
      //   selector['$and'].push({'label': {'$in': ['?']}});
      // }
      
      // skeletons.forEach(function (skeleton) {
      //   console.log(skeleton);

    
      //   // select examples not matching the skeleton
      //   selector['$and'][0]['$nor'].push(computeSelectorFromSkeleton(skeleton));
    
      // });

      selector = {'$and': []};
      selector['$and'].push({'label': {'$in': ['?']}});

      
    } else if (filterType == 'matching') {
      var skeletons = buildSkeleton();

      console.log('[inspectExamples] skeletons', skeletons)

      var patternNumber = argument;
      var skeleton = skeletons[patternNumber];

      selector = computeSelectorFromSkeleton(skeleton);
    } else if (filterType == 'feature-matching') {

      var node = argument;

      
      selector = {'$and': []};
      var nodeSelector = {};
      nodeSelector[node] = {'$exists': true};
      selector['$and'].push(nodeSelector);
    } else if (filterType =='pseudolabel-matching') {

      var pseudolabel = argument;
      selector = {'$and': []};
      var pseudolabelSelector = {};
      pseudolabelSelector['pseudolabel'] = pseudolabel;
      var explanationSelector = {};
      explanationSelector['explanation'] = pseudolabel;
      // combine with '$or'
      selector['$and'].push({'$or': [pseudolabelSelector, explanationSelector]});

      // selector['$and'].push(pseudolabelSelector);

    } else {
      selector = JSON.parse(filterType);

      var patternNumber = argument;

      // fetch Refinements
      var refinement = Refinements.findOne({ruleNumber: parseInt(patternNumber)});
      console.log('[inspectExamples] refinement', refinement);

      if (refinement) {
        // take difference of selectedNodes and disabledWords
        var selectedNodes = _.difference(refinement.selectedNodes, refinement.disabledWords);

        selectedNodes.forEach(node => {
          if (node.includes('*')) {
            selector['codeElements'] = { '$regex': node, '$options': 'i' };
          } else {
            selector[node] = {'$exists': true};
          }
        });

        // freeze the refinment
        // Refinements.update({ ruleNumber: patternNumber }, { $set: {frozen: true }});
      }

      // if (patternNumber > -1) {
      //   // freeze the rule
      //   Containment.update({ patternNumber: patternNumber }, { $set: {frozen: true }});
      //   freezePredicatesInRule(patternNumber);
      // }
    } 
    
      
    console.log('[inspectExamples]', JSON.stringify(selector));

    selector['graphId'] = { '$exists' : true };
    var examples = Examples.find(selector).fetch();

    // let lp_queryExamples = '';
    // examples.forEach(function (example) {
    //   lp_queryExamples += 'query(' + example.exampleID + ').\n';
    // });
    // fsPromises.writeFile(projectPath + '/code/lp/' + 'query_examples.lp', lp_queryExamples);

    console.log('[inspectExamples]', examples.length);
    Examples.update({exampleID: {$in: _.pluck(examples, 'exampleID')}}, {$set: {query: true}}, {multi: true});
    
  },
  'labelAllMatchingExamples' ({label}) {

    // fetch all queried examples
    var examples = Examples.find({query: true}).fetch();

    // label all of them
    Examples.update({exampleID: {$in: _.pluck(examples, 'exampleID')}}, {$set: {label: label}}, {multi: true});

    console.log('label all matching examples', label);
    var dir = path.resolve('.').split('.meteor')[0];
    var filename = dir + '_' + subjectNum + '_' + warningShortName + '_labelall_record.txt';
    
    var examplesStr = '';
    examples.forEach(function (example) {
      examplesStr += example.exampleID + ' ';
    });

    console.log(filename);
    fs.appendFile(filename, examplesStr +"\n", function(err) {
      if(err) {
        return console.log(err);
      }
      console.log("The file was appended to!");
    });
    
  },
  'suppressContainment' ({selector, argument, words}) {
    

    console.log('[suppressContainment]');
    selector = JSON.parse(selector);

    // filter using words
    if (words) {
      var wordsArray = words.split(',');
      if (!selector['$and']) {
        selector['$and'] = [];
      }

      var wordSelector = {}
      wordsArray.forEach(node => {
        if (node.includes('*')) {
          wordSelector['codeElements'] = { '$regex': node, '$options': 'i' };
        } else {
          wordSelector[node] = {'$exists': true};
        }
      });
      selector['$and'].push(wordSelector);

    }

    console.log('[suppressContainment] selector', selector);
    // label all of them
    Examples.update(selector, {$set: {label: 'positive'}}, {multi: true});

    
    const ruleNumber = argument;    

    // frozen rules
    // var containment = Containment.findOne({patternNumber: parseInt(ruleNumber)});
    // var lp_frozen_rules = '';
    // for (var rawOutputIndex = 0; rawOutputIndex < containment['rawOutput'].length; rawOutputIndex ++) {
    //   var rawOutput = containment['rawOutput'][rawOutputIndex];
    //   lp_frozen_rules += 'fixed_rule_contains' + ruleNumber + '(' + rawOutput + ').\n';
    // }
    // fsPromises.appendFile(projectPath + '/code/lp/frozen_rules.lp', lp_frozen_rules);
    freezePredicatesInRule(ruleNumber);

    // freeze the refinment
    Refinements.update({ ruleNumber: ruleNumber }, { $set: {frozen: true }});

    // freeze the rule
    Containment.update({ patternNumber: ruleNumber }, { $set: {frozen: true }});

  },
  'inspectContainment' ({selector, argument, words}) {
   

    console.log('[inspectContainment] selector', selector);
    selector = JSON.parse(selector);

    // filter using words
    if (words) {
      var wordsArray = words.split(',');
      if (!selector['$and']) {
        selector['$and'] = [];
      }
      
      var wordSelector = {}
      wordsArray.forEach(node => {
        if (node.includes('*')) {
          wordSelector['codeElements'] = { '$regex': node, '$options': 'i' };
        } else {
          wordSelector[node] = {'$exists': true};
        }
      });
      selector['$and'].push(wordSelector);
    }
    console.log('[inspectContainment] selector', selector);
    
    // label all of them
    Examples.update(selector, {$set: {label: 'negative'}}, {multi: true});

    const ruleNumber = argument;

    // frozen rules
    freezePredicatesInRule(ruleNumber);
    
    // freeze the refinment
    Refinements.update({ ruleNumber: ruleNumber }, { $set: {frozen: true }});

    // freeze the rule
    Containment.update({ patternNumber: ruleNumber }, { $set: {frozen: true }});

  },
  'inferPatternFromContainment' ({filterType, argument, focalNode, view}) {
    var selector;
    if (filterType == 'type') {
      selector = {'$and': []};
      var typeSelector = {};
      typeSelector['ancestry'] = argument;

      selector['$and'].push(typeSelector);
    } else if (filterType == 'pkg') {
      selector = {'$and': []};
      var pkgSelector = {};
      pkgSelector['pkg'] = { '$regex': argument, '$options': 'i' };
      
      selector['$and'].push(pkgSelector);
    } else if (filterType == 'name') {
      selector = {'$and': []};
      var nameSelector = {};
      nameSelector['classname'] = argument;
      selector['$and'].push(nameSelector);
    } else if (filterType == 'retType') {
      selector = {'$and': []};
      var retTypeSelector = {};
      retTypeSelector['retType'] = argument;
      selector['$and'].push(retTypeSelector);
    } else if (filterType == 'fieldsUsed') {
      selector = {'$and': []};
      var fieldUsedSelector = {};
      fieldUsedSelector['fieldsUsed'] = argument;
      selector['$and'].push(fieldUsedSelector);
    } 

    console.log('[inferPatternFromContainment] selector', selector);
    // fetch
    var examples = Examples.find(selector).fetch();
    console.log('[inferPatternFromContainment] examples', examples.length);

    minePatternsFromSelector(view, matchSink, selector, focalNode)

  },
  'initializeBagOfWordsFromSelectedCode' ({selectedNodes, ruleNumber, focalNode, view}) {
    console.log('[initializeBagOfWordsFromSelectedCode] selectedNodes', selectedNodes);
    if (selectedNodes.length == 0) {
      return;
    }
    console.log('[initializeBagOfWordsFromSelectedCode] start refining rule');

    
    // upsert
    var refinement = Refinements.findOne({ruleNumber: parseInt(ruleNumber)});
    if (!refinement) {
      Refinements.insert({ruleNumber: parseInt(ruleNumber), selectedNodes: [], disabledWords: []});
    }
    // update the Refinement
    var refinement = Refinements.findOne({ruleNumber: parseInt(ruleNumber)});
    console.log('[initializeBagOfWordsFromSelectedCode] refinement', refinement);

    // now, take union of selectedNodes
    // but it would be worthwhile to consider taking the intersection of the selectedNodes instead
    Refinements.update({_id: refinement._id}, {$addToSet: {selectedNodes: {$each: selectedNodes}}});
    console.log('[initializeBagOfWordsFromSelectedCode] updated refinement', Refinements.findOne({ruleNumber: parseInt(ruleNumber)}));

    console.log(selectedNodes);
    // on top of Refinements, update hte ILP rules so that the selected code elements can be included in the ILP rules
    var lp_code_rules = '';
    for (var selectedNodeIndex = 0; selectedNodeIndex < selectedNodes.length; selectedNodeIndex ++) {

      var morePatterns = generateWildcardPatterns(selectedNodes[selectedNodeIndex].replace('__', '.'));
      var morePrefixPatterns = generateWildcardPatternsForPrefix(selectedNodes[selectedNodeIndex].replace('__', '.'));

      // union
      var morePatterns = morePatterns.concat(morePrefixPatterns);

      for (patternIndex = 0; patternIndex < morePatterns.length; patternIndex ++) {
        const codePattern = morePatterns[patternIndex];

        var lowerCaseFirstLetter = codePattern.charAt(0).toLowerCase() + codePattern.substring(1);
        // escape for ILP
        var logicRepresentation = lowerCaseFirstLetter.replace(/\./g, '__').replace(/\(/g, '_lp').replace(/\)/g, '_rp').replace(/:/g,'_colon_').replace('[', '_lb').replace(']', '_rb').replace('<', '_lt').replace('>', '_gt').replace(/ /g, '__s__').replace(/%/g, '__amp__').replace(/\+/g, '__plus__');

        // find examples containing the selected code element

        console.log(codePattern)
        var examples = Examples.find(
          {'codeElements': { '$regex': codePattern.replace('__dotstar__', '.*'), '$options': 'i' }}).fetch();

        console.log('[initializeBagOfWordsFromSelectedCode] examples', examples.length);
        // update the ILP rules
        examples.forEach(function (example) {
          lp_code_rules += 'containment'  + '(' + example.exampleID + ',' +  'code_' + logicRepresentation + ').\n';
        });
      }

      


    }
    fsPromises.appendFile(projectPath + '/code/lp/selected_code_rules.lp', lp_code_rules);


    // freeze the refinment
    Refinements.update({ ruleNumber: ruleNumber }, { $set: {frozen: true }});
    

    // freeze the rule
    Containment.update({ patternNumber: ruleNumber }, { $set: {frozen: true }});
    freezePredicatesInRule(ruleNumber);
      
  },
  'resetLabels'({ exampleId, methodName, labels, view, keyword, focalNode }) {
    console.log('reset labels');

    Examples.update({}, {$set: {label: '?'}} , {multi: true}, function (error, result) {
      if (!error) {
        console.log('reset labels done without error '  + result);
      } else {
        console.log('error when updating Examples with label---->' + error);
      }
      console.log(Examples.find({}).fetch().map(example => example.label));
    });
    Subgraphs.update({hint: true} , {$set: {hint: null}}, {multi: true}, function (error, result) {
      if (!error) {
        console.log('reset labels done without error '  + result);
      } else {
        console.log('error when updating Examples with label---->' + error);
      }
      console.log(Subgraphs.find({}).fetch().map(example => example.hint));
    });
    
  },
  'updateWordRefinement'({word, ruleNumber, selected}) {
    console.log('updateWordRefinement', word, selected);

    // update the Refinement
    var refinement = Refinements.findOne({ruleNumber: parseInt(ruleNumber)});
    console.log('[updateWordRefinement] refinement before:', refinement);
    if (!selected) {
      Refinements.update({_id: refinement._id}, {$addToSet: {disabledWords: word}}); 
    } else {
      Refinements.update({_id: refinement._id}, {$pull: {disabledWords: word}}); 
    }

    
    

  },

  'inferPatterns'() {    
    inferPatterns();
  },
  'addHint'({text, value}) {

    var adjlist = {};
    var edges = [];
    if (text.includes('->')) { // an edge was passed
      nodes = text.split('->');
      nodes = nodes.map(function (x) { 
        return x.trim().split(' ')[0]; 
      });
      var edgeType = text.split('->')[1].trim().split(' ')[1];
      adjlist[nodes[0]] = []
      adjlist[nodes[0]].push({to: nodes[1], label: edgeType});

      edges.push({from: nodes[0], to: nodes[1], label: edgeType, rawText:text});
      
    } else {
      adjlist[text] = []
      adjlist[text].push({to: '', label: ''});

      
      edges.push({from: text, to: '', label: '', rawText:text});
    }

    // delete the old hint if it exists
    Subgraphs.remove({rawText:text, hint: true});

    var newSubgraph = {
      rawText: text,
      hint: value,
      adjlist: adjlist,
      edges: edges
    };
    console.log('[addHint] inserting newSubgraph', newSubgraph);
    Subgraphs.insert(newSubgraph, function (error, result) {
      if (error) {
        console.log('[ addHint] error when inserting new subgraph---->' + error);
      } else {
        console.log('[addHint] inserted new subgraph with id ' + result);
      }
    });


  },
  'createNewSubgraph'({text, checked, isPattern}) {

    var adjlist = {};
    var edges = [];

    if (text.includes(',')) { 
      nodes = text.split(',');

      console.log('creating new subgraph with ' + ' text=' + text + ' checked=' + checked + ' isPattern=' + isPattern);
      
      for (var i = 1; i < nodes.length; i++) {
        var node = nodes[i];

        var prevNode = nodes[i-1];

        var nodeWithoutEdge = node.includes('{') ? node.split('{')[0] : node;
        var prevNodeWithoutEdge = prevNode.includes('{') ? prevNode.split('{')[0] : prevNode;


        var label = prevNode.includes('{') ? prevNode.split('{')[1].split('}')[0] : '';
        console.log('label is ' + label + ' of ' + prevNode);
        
        adjlist[prevNodeWithoutEdge] = []
        adjlist[prevNodeWithoutEdge].push({to: nodeWithoutEdge, label: label});
        adjlist[nodeWithoutEdge] = []
        adjlist[nodeWithoutEdge].push({to: '', label: ''});

        edges.push({from: prevNodeWithoutEdge, to: nodeWithoutEdge, label: label, rawText:text});
      }
    } else if (text.includes('->')) { // an edge was passed
      nodes = text.split('->');
      nodes = nodes.map(function (x) { 
        return x.trim().split(' ')[0]; 
      });
      var edgeType = text.split('->')[1].trim().split(' ')[1];
      adjlist[nodes[0]] = []
      adjlist[nodes[0]].push({to: nodes[1], label: edgeType});

      edges.push({from: nodes[0], to: nodes[1], label: edgeType, rawText:text});
      
    } else {
      adjlist[text] = []
      adjlist[text].push({to: '', label: ''});

      
      edges.push({from: text, to: '', label: '', rawText:text});
    }

    var newSubgraph = {
      rawText: text,
      labelled: checked,
      discriminative: true,
      alternative: false,
      isPattern: isPattern,
      adjlist: adjlist,
      edges: edges
    };
    console.log('inserting newSubgraph', newSubgraph);
    Subgraphs.insert(newSubgraph, function (error, result) {
      console.log('error when inserting new subgraph---->' + error);
    });

     
      
    
  },
  'updateSubgraphs' ({subgraphId, text, checked, isPattern}) {
    console.log('updating subgraphs with _id=' + subgraphId + ' text=' + text + ' checked=' + checked + ' isPattern=' + isPattern);
    if (isPattern == null) {
      if (Subgraphs.find({rawText: text, discriminative: true}).count() <= 1 ) {
       var a  = Subgraphs.update( {_id: subgraphId} , {$set: {labelled: checked, discriminative: true, alternative: false, hint: null}});
      //  console.log('a = ' + a);
      }
    } else {
      if (Subgraphs.find({rawText: text, discriminative: true}).count() <= 1) {
       var a = Subgraphs.update( {_id: subgraphId} , {$set: {labelled: checked, discriminative: true, alternative: false, isPattern: isPattern, hint: null}});
      //  console.log('a = ' + a);
      }
    }
  },
  

  'computeQueryExamples'() {
    // reset examples with query

    var hasQuerySelector = {'$and': [{query: {$exists: true}}]};
    // var selector = constructSelectorToFilterBaggedPatterns(hasQuerySelector);
    Examples.find(hasQuerySelector).forEach(function (example) {

      Examples.update({_id: example._id}, {$set: {query: null}});
    });
    console.log('computeQueryExamples, reset done');

    shellOutToComputeQueryExamples();



  },
  'clearHints'() {
    console.log('clearHints');
    Subgraphs.update({hint: true}, {$set: {hint: false}}, {multi: true});
  },
  'endTask' ({subjectNum, isBaseline}) {

    console.log('end task!');
    console.log(subjectNum);


    // write subgraphs to file
    var fs = require('fs');
    var path = require('path');
    var dir = path.resolve('.').split('.meteor')[0];
    var baseline = isBaseline ? '_baseline' : '';
    
    // write labels of the example Ids to file
    var examples = Examples.find({ '$and' :
      [
        {'graphId': {'$exists': true}},
      ]});
    var exampleIds = examples.map(function (example) {
      return example.exampleID;
    }
    );
    var labels = examples.map(function (example) {
      return example.label;
    }
    );
    var labelsText = exampleIds.map(function (exampleId, i) {
      return exampleId + ' ' + labels[i];
    }
    ).join('\n');
    console.log(labelsText);

    var labelsFileName = dir + '_' + subjectNum + '_' + baseline + '_labels.txt';
    console.log(labelsFileName);
    fs.writeFile(labelsFileName, labelsText, function(err) {
      if(err) {
        return console.log(err);
      }
      console.log("The labels file was saved!");
    });

  
  },


  'resetState' () {
    resetDatabase();
  }

});
function freezePredicatesInRule(ruleNumber) {
  var containment = Containment.findOne({ patternNumber: parseInt(ruleNumber) });
  var lp_frozen_rules = '';
  if (containment) {
    for (var rawOutputIndex = 0; rawOutputIndex < containment['rawOutput'].length; rawOutputIndex++) {
      var rawOutput = containment['rawOutput'][rawOutputIndex];
      lp_frozen_rules += 'fixed_rule_contains' + ruleNumber + '(' + rawOutput + ').\n';
    }
  }

  var refinement = Refinements.findOne({ ruleNumber: parseInt(ruleNumber) });
  if (refinement) {
    for (var selectedNodeIndex = 0; selectedNodeIndex < refinement['selectedNodes'].length; selectedNodeIndex++) {
      var selectedNode = refinement['selectedNodes'][selectedNodeIndex];

      var lowerCaseFirstLetter = selectedNode.charAt(0).toLowerCase() + selectedNode.substring(1);
      // escape for ILP
      var logicRepresentation = lowerCaseFirstLetter.replace(/\./g, '__').replace(/\(/g, '_lp').replace(/\)/g, '_rp').replace(/:/g,'_colon_').replace('[', '_lb').replace(']', '_rb').replace('<', '_lt').replace('>', '_gt').replace(/ /g, '__s__').replace(/%/g, '__amp__').replace(/\+/g, '__plus__');

      lp_frozen_rules += 'fixed_rule_contains' + ruleNumber + '(' + 'code_' + logicRepresentation + ').\n';
    }
  }


  fsPromises.appendFile(projectPath + '/code/lp/frozen_rules.lp', lp_frozen_rules);
}

function saveRuleNameToDb(ruleNumber, ruleName) {
  Config.update({ruleNumber: parseInt(ruleNumber)}, {$set: {ruleName: ruleName}}, {upsert: true});
}
function fetchRuleNameFromDb(ruleNumber) {
  // console.log('[fetchRuleNameFromDb] ruleNumber', ruleNumber)
  var config = Config.findOne({ruleNumber: ruleNumber});
  if (config) {
    // console.log('[fetchRuleNameFromDb] ruleName', config.ruleName);
    return config.ruleName;
  }
  // console.log('[fetchRuleNameFromDb] ruleName not found');
  return null;
}

function updateLabels(view, matchSink, exampleId, methodName, focalNode, labels) {
  var targetGraphId = -1;
  // given the exampleId and methodName, match the graph id based on java.security.MessageDigest__digest_graph_id_mapping.txt
  // the `java.security.MessageDigest__digest` files came from manually running scripts in the src2egroum2aug (HJGraphBuilderForActiveLearningInterface) project in eclipse
  var elementIdToGraphId = {};

  var selector = {};
  console.log('updating labels, selector is ', selector, 'view is ', view);
  console.log('count is ', Examples.find(selector).count());

  var sourceExampleId = -1;
  var sourceGraphId = -1;
  Examples.find(selector).forEach(function (example) {
    if (matchSink) {
      elementIdToGraphId[example.exampleID] = example.graphId;
    } else {
      // pick the exampleId and graphId from `steps` (currently only one step)
      sourceExampleId = example.steps[0].exampleID;
      sourceGraphId = example.steps[0].graphId;
      elementIdToGraphId[sourceExampleId] = sourceGraphId;
    }
  });


  if (matchSink && elementIdToGraphId.hasOwnProperty(exampleId)) {
    targetGraphId = elementIdToGraphId[exampleId];
  } else if (!matchSink && elementIdToGraphId.hasOwnProperty(sourceExampleId)) { // matching souce, so check for sourceExampleId
    targetGraphId = elementIdToGraphId[methodName];
  } else {
    targetGraphId = -1;
  }
  var eraseOld = true;
  if (focalNode == null) {
    focalNode = "---dummy---";
    // eraseOld = true;
  }
  console.log(' [updateLabels] ' + 'focalNode ' + focalNode + " eraseOld= " + eraseOld);
  shellOutToMineSubgraphs(targetGraphId, labels, elementIdToGraphId, focalNode, null, eraseOld, false);
}

function minePatternsFromSelector(view, matchSink, selector, focalNode) {
  // given the exampleId and methodName, match the graph id based on java.security.MessageDigest__digest_graph_id_mapping.txt
  // the `java.security.MessageDigest__digest` files came from manually running scripts in the src2egroum2aug (HJGraphBuilderForActiveLearningInterface) project in eclipse
  var elementIdToGraphId = {};

  console.log('[minePatternsFromSelector] updating labels, selector is ', selector, 'view is ', view);
  console.log('[minePatternsFromSelector] count is ', Examples.find(selector).count());

  var sourceExampleId = -1;
  var sourceGraphId = -1;
  Examples.find(selector).forEach(function (example) {
    if (matchSink) {
      elementIdToGraphId[example.exampleID] = example.graphId;
    } else {
      // pick the exampleId and graphId from `steps` (currently only one step)
      sourceExampleId = example.steps[0].exampleID;
      sourceGraphId = example.steps[0].graphId;
      elementIdToGraphId[sourceExampleId] = sourceGraphId;
    }
  });

  
  var eraseOld = true;
  if (focalNode == null) {
    focalNode = "---dummy---";
    // eraseOld = true;
  }
  console.log(' [minePatternsFromSelector] ' + 'focalNode ' + focalNode + " eraseOld= " + eraseOld);
  shellOutToMineSubgraphs(-1, null, elementIdToGraphId, focalNode, null, eraseOld, true);
}

function minePatternsFromSelectedCode(selectedNodes, focalNode, view) {
// given the exampleId and methodName, match the graph id based on java.security.MessageDigest__digest_graph_id_mapping.txt
  // the `java.security.MessageDigest__digest` files came from manually running scripts in the src2egroum2aug (HJGraphBuilderForActiveLearningInterface) project in eclipse
  var elementIdToGraphId = {};



  var sourceExampleId = -1;
  var sourceGraphId = -1;
  Examples.find({graphId : {'$exists': true}}).forEach(function (example) {
    if (matchSink) {
      elementIdToGraphId[example.exampleID] = example.graphId;
    } else {
      // pick the exampleId and graphId from `steps` (currently only one step)
      sourceExampleId = example.steps[0].exampleID;
      sourceGraphId = example.steps[0].graphId;
      elementIdToGraphId[sourceExampleId] = sourceGraphId;
    }
  });

  
  var eraseOld = true;
  if (focalNode == null) {
    focalNode = "---dummy---";
    // eraseOld = true;
  }
  var nodesToInclude = selectedNodes;
  console.log(' [minePatternsFromSelectedCode] ' + 'focalNode ' + focalNode + " eraseOld= " + eraseOld);
  shellOutToMineSubgraphs(-1, null, elementIdToGraphId, focalNode, nodesToInclude, eraseOld, true);

}

// function insertRule(commonNames, commonPackages, commonSubtypes, commonReturnTypes, commonFieldsUsed, rawOutput) {
//   // merge the promises for common names, packages, subtypes, return types, and fields used
//   var promises = Promise.all([commonNames, commonPackages, commonSubtypes, commonReturnTypes, commonFieldsUsed, rawOutput]);
//   promises.then(function (values) {
//     const allNames = values[0];
//     const allPkgs = values[1];
//     const allSubtypes = values[2];
//     const allReturnTypes = values[3];
//     const allFieldUseds = values[4];
//     const rawOutput = values[5];

//     for (var patternNumber = 0; patternNumber < allNames.length; patternNumber ++) {
//       const name = allNames[patternNumber];
//       const pkg = allPkgs[patternNumber];
//       const subtype = allSubtypes[patternNumber];
//       const returnType = allReturnTypes[patternNumber];
//       const fieldUsed = allFieldUseds[patternNumber];
//       const output = rawOutput[patternNumber];

//       // continue if the output is empty
//       if (output == '') {
//         continue;
//       }

//       if (Containment.find({ patternNumber: patternNumber }).count() == 0) {
//         // insert
//         Containment.insert({ patternNumber: patternNumber, classname: name, pkg: pkg, type: subtype, retType: returnType, fieldUsed: fieldUsed, selected: true, rawOutput:output});

//       } else {

//         // update
//         Containment.update({ patternNumber: patternNumber }, { $set: { classname: name, pkg: pkg, type: subtype, retType: returnType, fieldUsed: fieldUsed} });

//         // append output
//         Containment.update({ patternNumber: patternNumber }, { $push: { rawOutput: output } });
//       }
//     }
    
//   });

function insertRule(commonNames, commonPackages, commonSubtypes, commonReturnTypes, commonFieldsUsed, commonCode, rawOutput) {
  // merge the promises for common names, packages, subtypes, return types, and fields used
  var promises = Promise.all([commonNames, commonPackages, commonSubtypes, commonReturnTypes, commonFieldsUsed,commonCode, rawOutput]);
  // console.log('commonNames', commonNames);
  // console.log('commonPackages', commonPackages);
  // console.log('commonSubtypes', commonSubtypes);
  // console.log('commonReturnTypes', commonReturnTypes);
  // console.log('commonFieldsUsed', commonFieldsUsed);
  // console.log('commonCode', commonCode);
  // console.log('rawOutput', rawOutput);

  promises.then(function (values) {
    const allNames = values[0];
    const allPkgs = values[1];
    const allSubtypes = values[2];
    const allReturnTypes = values[3];
    const allFieldUseds = values[4];
    const allCode = values[5];
    const rawOutput = values[6];
    // const allRuleName = values[7];
    // console.log('allRuleName', allRuleName);

    for (var patternNumber = 0; patternNumber < allNames.length; patternNumber ++) {
      const name = allNames[patternNumber];
      const pkg = allPkgs[patternNumber];
      const subtype = allSubtypes[patternNumber];
      const returnType = allReturnTypes[patternNumber];
      const fieldUsed = allFieldUseds[patternNumber];
      const code = allCode[patternNumber];
      const output = rawOutput[patternNumber];
      const savedRuleName = fetchRuleNameFromDb(patternNumber) ;
      const ruleName = savedRuleName ? savedRuleName : null;

      // continue if the output is empty
      if (output == '') {
        continue;
      }

      
      // unescape the code
      if (code[0]) {
        // console.log(  'code', code[0]);
        code[0] = code[0].replace(/_dot_/g, '.').replace(/_slash_/g, '/').replace(/_lt_/g, '<').replace(/_gt_/g, '>').replace(/__s__/g, ' ').replace(/'_colon_'/, ':').replace(/__amp__/g, '%').replace(/__plus__/g, '+').replace(/_lp/g, '(').replace(/_rp/g, ')').replace(/_lp/g, '(').replace(/_rp/g, ')');
        // first letter is upper case
        code[0] = code[0].charAt(0).toUpperCase() + code[0].slice(1);

        // console.log(  'after unescape: code=', code[0]);
      }
      

      if (Containment.find({ patternNumber: patternNumber }).count() == 0) {
        // insert
        Containment.insert({ patternNumber: patternNumber, classname: name, pkg: pkg, ancestry: subtype, retType: returnType, fieldsUsed: fieldUsed, selected: true, rawOutput:output, ruleName: ruleName});

        // code goes into refinement
        if (code[0]) {
          // console.log(  'insertion', code[0]);
          Refinements.insert({ ruleNumber: patternNumber, selectedNodes: code, disabledWords: []});
        }
      } else {

        // update
        Containment.update({ patternNumber: patternNumber }, { $set: { classname: name, pkg: pkg, ancestry: subtype, retType: returnType, fieldsUsed: fieldUsed, ruleName: ruleName} });

        // append output
        Containment.update({ patternNumber: patternNumber }, { $push: { rawOutput: output } });

        // code goes into refinement
        if (code[0]) {
          // console.log(  'update', code[0]);
          Refinements.update({ ruleNumber: patternNumber }, { $addToSet: {selectedNodes: code}});
        }
      }
    }
    
  });
}

function introduceMoreChoiceRules(ruleNumber) {
  var lp_more_choice_rules = '0 { rule_contains'  +  ruleNumber + '(X) : containment(_, X) } 3.\n';
  
  fsPromises.appendFile(projectPath + '/code/lp/frozen_rules.lp', lp_more_choice_rules);
}