import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Session } from 'meteor/session';

import { Examples, TestExamples } from '../api/options.js';
import { ActionLog } from '../api/actionlog.js';
import { Subgraphs } from '../api/subgraphs.js';
import { Containment } from '../api/containment.js';
import { Refinements } from '../api/refinements.js';
import { Bags } from '../api/bags.js';
import { Config } from '../api/config.js';

import { Queries } from '../api/queries.js';

import Pycollections from 'pycollections';

import html2canvas from 'html2canvas';


import 'bootstrap/dist/css/bootstrap.min.css'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

import './body.html'; 

window.Subgraphs  = Subgraphs;
window.Examples = Examples;
window.TestExamples = TestExamples;
window.Containment = Containment;
window.Refinements = Refinements;
window.Config = Config;

MAX_RULE = 5;

/** 
var addCollapsibleListener = function() {
  var coll = document.getElementsByClassName("collapsible");
  var i;
  console.log('coll', coll);


  for (i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function() {
      this.classList.toggle("active");
      var content = this.nextElementSibling;
      if (content.style.display === "block") {
        content.style.display = "none";
      } else {
        content.style.display = "block";
      }
    });
  } 
}
//addCollapsibleListener();
*/

var toggleContents = function(className) {
  // Find all elements with the specified class and toggle their display
  var contents = document.querySelectorAll('.' + className);
  console.log('contents', contents);
  contents.forEach(function(content) {
      console.log('content.style.display', content.style.display);
      if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
      } else {
          content.style.display = "none";
      }
  });
}
var hideContents = function(className) {
  // Find all elements with the specified class and toggle their display
  var contents = document.querySelectorAll('.' + className);
  console.log('contents', contents);
  contents.forEach(function(content) {
      console.log('content.style.display', content.style.display);
      content.style.display = "none";
  });
}

var fetchAndCountExamples = function(selector){
  if (_.isEmpty(selector)){
    selector = {'dataset': Session.get('dataset')};
  } else {
    selector['dataset'] = Session.get('dataset');
  }
  // filter out examples without a corresponding graph
  // if (!selector['$and']){
  //   selector['$and'] = [];
  // }
  // selector['$and'].push( {'graphId' : { '$exists' : true } } );
  return Examples.find(selector).count();
}

var fetchShortestExamples = function(selector){
  if (_.isEmpty(selector)){
    selector = {'dataset': Session.get('dataset')};
  } else {
    selector['dataset'] = Session.get('dataset');
  }
  // filter out examples without a corresponding graph
  if (!selector['$and']){
    selector['$and'] = [];
  }
  selector['$and'].push( {'graphId' : { '$exists' : true } } );

  // hack over edges.. ignore directions for non-order
  selector['$and'] = selector['$and']
  // .map(function(item){
  //   var newItem = {};
  //   Object.keys(item).forEach(function(key){
  //     if (key.includes('->') 
  //     // && !key.includes("order")
  //     ) {
  //       var node1 = key.split(' -> ')[0];
  //       var node2 = key.split(' -> ')[1].split(' ')[0];
  //       var newEdge = node2 + ' -> ' + node1 + ' ' + key.split(' -> ')[1].split(' ')[1];
  //       var newObj = {};
  //       newObj[newEdge] = item[key];
  //       var newKey = '$or';
  //       newItem[newKey] = [item, newObj];
  //     } else {
  //       var newKey = key;
  //       newItem[newKey] = item[key];
  //     }
      
  //   });
  //   return newItem;  
  // });


  var matchSink = Session.get('matchSink');

  if (!matchSink) {
    var dataset = selector['dataset'];

    var oldLabel;
    // enumerate over selector and look for 'label' in key
    selector['$and'].forEach(function(item){
      var oldKey = Object.keys(item)[0];
      if (oldKey == 'label') {
        oldLabel = item[oldKey];
      }
    });
    // sometimes, the label isn't in '$and', but is in the top level
    if (!oldLabel) {
      oldLabel = selector['label'];
    }

    var newSelector = {'$and': []}
    if (oldLabel) {
     newSelector = {'$and': [{'label' : oldLabel}]}
    }
    selector['$and'].forEach(function(item){
      // newSelector['steps.0.' + item] = selector['$and'][item];
      var oldKey = Object.keys(item)[0];
      if (oldKey == 'label') return;
      var newKey = 'steps.0.' + oldKey;
      var newItem = {};
      newItem[newKey] = Object.values(item)[0];
      newSelector['$and'].push(newItem);
    });
    
    newSelector['dataset'] = dataset;

    selector = newSelector;
  }

  // console.log('selector',selector);
  return Examples.find(selector, { sort: { codeLength : 1 } });
}



var updateWordRefinement = function(word, ruleNumber, selected, nextFunction) {
  Meteor.call('updateWordRefinement', {
    word: word,
    ruleNumber: ruleNumber,
    selected: selected,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[updateWordRefinement] succeded in updating word refinement')
      if (nextFunction)


        nextFunction();

    }
  });

}

var updateParticipantID = function(participantID) {


  Meteor.call('updateParticipantID', {
    participantID: participantID,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[updateParticipantID] succeded in updating participantID')

    }
  });
}

var updateRuleName = function(ruleNumber, ruleName, nextFunction) {
  Meteor.call('updateRuleName', {
    ruleNumber: ruleNumber,
    ruleName: ruleName,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[updateRuleName] succeded in updating ruleName')
      if (nextFunction)
        nextFunction();
    }
  });
}

var updatePackage = function(packageId, selected, nextFunction) {

  Meteor.call('updatePackage', {
    packageId: packageId,
    selected: selected,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!

      console.log('[updatePackage] succeded in updating package')
      if (nextFunction)
        nextFunction();
    }
  });
}
var updateClassname = function(classnameId, selected, nextFunction) {

  Meteor.call('updateClassname', {
    classnameId: classnameId,
    selected: selected,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!

      console.log('[updateClassname] succeded in updating classnameId')
      if (nextFunction)
        nextFunction();
    }
  });
}


var updateSubtype = function(subtypeId, selected, nextFunction) {

  Meteor.call('updateSubtype', {
    subtypeId: subtypeId,
    selected: selected,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!

      console.log('[updateSubtype] succeded in updating subtype')
      if (nextFunction)
        nextFunction();
    }
  });
}

var updateLabels = function(exampleId, methodName, label, keyword, mineSink, triggerMining, nextFunction) {
  // console.log(instance);
  // console.log('ruleName body meteorcall', ruleName);
  Meteor.call('updateLabels', {
    exampleId: exampleId,
    methodName: methodName,
    labels: label,
    view: Session.get('view'),
    keyword: keyword,
    focalNode: '',
    matchSink: mineSink,
    triggerMining: triggerMining,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[updateLabels] succeded in updating labels')
      // clearSummary();
      if (nextFunction)
        nextFunction();
    }
  });
}



var endTask = function(nextFunction) {
  // console.log(instance);

  Meteor.call('endTask', {
    subjectNum: Session.get('subjectNum'),
    isBaseline: Session.get('isBaseline'),
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[endTask] succeded')
      
      if (nextFunction)
        nextFunction();
    }
  });
}

var updateExplanation = function(exampleId, explanation, propagate, nextFunction) {
  // console.log(instance);

  Meteor.call('updateExplanation', {
    exampleId: exampleId,
    explanation: explanation,
    propagate: propagate,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[updateExplanation] succeded')
      
      if (nextFunction)
        nextFunction();
    }
  });


}

var inspectExamples = function(filterType, argument, nextFunction) {
  Meteor.call('inspectExamples', {
    filterType: filterType,
    argument: argument,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[inspectExamples] succeded')
      
      if (nextFunction)
        nextFunction();
    }
  });
}

var suppressContainment = function(selector, argument, words, nextFunction) {
  Meteor.call('suppressContainment', {
    selector: selector,
    argument: argument,
    words: words,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[suppressContainment] succeded')
      
      if (nextFunction)
        nextFunction();
    }
  });
}

var inspectContainment = function(selector, argument, words, nextFunction) {
  Meteor.call('inspectContainment', {
    selector: selector,
    argument: argument,
    words: words
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[inspectContainment] succeded')

      if (nextFunction)

        nextFunction();
    }
  });
}

var initializeBagOfWordsFromSelectedCode = function(selectedNodes, ruleNumber, nextFunction) {

  Meteor.call('initializeBagOfWordsFromSelectedCode', {
    selectedNodes: selectedNodes,
    ruleNumber: ruleNumber,
    focalNode: '',
    view: Session.get('view')
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[initializeBagOfWordsFromSelectedCode] succeded')

      if (nextFunction)

        nextFunction();
    }
  });
}

var inferPatternFromContainment = function(filterType, argument, nextFunction) {

  Meteor.call('inferPatternFromContainment', {
    filterType: filterType,
    argument: argument,
    focalNode: '',
    view: Session.get('view')
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[inferPatternFromContainment] succeded')

      if (nextFunction)

        nextFunction();
    }
  });
}

var labelAllMatchingExamples = function(label, nextFunction) {
  Meteor.call('labelAllMatchingExamples', {
    label: label
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[labelAllMatchingExamples] succeded')
      
      if (nextFunction)
        nextFunction();
    }
  });


}

var deleteDiscriminativeSubgraphs = function() {

  Meteor.call('deleteDiscriminativeSubgraphs', {
    view: Session.get('view'),
    keyword: Session.get('keyword'),
    focalNode: '',
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[deleteDiscriminativeSubgraphs] succeded in deleting discrimiantive subgraphs')
      clearSummary();
    }
  });
}

var resetLabels = function() {

  Meteor.call('resetLabels', {
    view: Session.get('view'),
    keyword: Session.get('keyword'),
    focalNode: '',
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[resetLabels] succeded in reset labels')
      clearSummary();
    }
  });
}

var clearHints = function() {
  Meteor.call('clearHints', {
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[clearHints] succeded in clearHints')
      // clearSummary();
    }
  });

}

var resetState = function() {
  Meteor.call('resetState', {
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[resetState] succeded in resetState')
      // clearSummary();
    }
  });
}

var computeQueryExamples = function(){

  Meteor.call('computeQueryExamples', 
    {}, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[computeQueryExamples] succeded in updating labels')
    }
  });

}

var inferPatterns = function() {

  Meteor.call('inferPatterns', {
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[inferPatterns] succeded in updating labels')
      // clearSummary();
    }
  });
}



var createNewSubgraph = function(text, checked, isPattern, nextFunction) {

  Meteor.call('createNewSubgraph', {
    text: text,
    checked: checked,
    isPattern: isPattern,
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[createNewSubgraph] succeded in creating new subgraph')

      nextFunction();
    }
  });
}

var addHint = function(text, value, nextFunction) {
  Meteor.call('addHint', {
    text: text,
    value: value
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('[addHint] succeded in creating new subgraph')

      nextFunction();
    }
  });
}





var getOpenaiCompletion = function(nextFunction) {

  Meteor.call('getOpenaiCompletion', {
    API: Session.get('focalAPI'),
  }, (err, res) => {
    if (err) {
      alert(err);
    } else {
      // success!
      console.log('succeded in getOpenaiCompletion')

      nextFunction(res);
    }
  });
}


var addSpan = function(exampleID, clusterContext, expressionStart,expressionEnd,blockname){
  if (expressionStart !== -1 && expressionEnd !== -1) {
    try {
      var clusterIdentifier = clusterContext ? '-' + clusterContext : '';
    spanAdder.addRegionsD3('#exampleID'+exampleID + clusterIdentifier+'-code',expressionStart,expressionEnd,blockname);
    } catch (e) {
      console.log('err -> ' + e);
    }
  } 
}
var removeSpan = function(exampleID,expressionStart,expressionEnd,blockname){
  if (expressionStart !== -1 && expressionEnd !== -1) {
    try {
      $('#exampleID' + exampleID + ' .' + blockname).removeClass(blockname);
      // console.log('remove span from ' + '#exampleID' + exampleID + ' .' + blockname);
    } catch (e) {
      console.log('err -> ' + e);
    }
  } 
}




var render = function(obj) {

  var clusterContext = obj['clusterContext'] ? '-' + obj['clusterContext'] : '';
  $('#exampleID' + obj['exampleID'] + clusterContext + ' pre').removeClass('example-highlighted-confused  example-highlighted-confused-correct example-highlighted-confused-misuse example-highlighted-correct example-highlighted-misuse');

  // match against `subgraph-0-node`
  $('#exampleID' + obj['exampleID'] + clusterContext + '  .subgraph-0-node').removeClass('subgraph-0-node');
  $('#exampleID' + obj['exampleID'] + clusterContext + '  .subgraph-0-node-correct').removeClass('subgraph-0-node-correct');
  $('#exampleID' + obj['exampleID'] + clusterContext + '  .subgraph-0-node-misuse').removeClass('subgraph-0-node-misuse');
  
  $('#exampleID' + obj['exampleID'] + clusterContext + ' .example-highlighted-correct').removeClass('example-highlighted-correct');
  $('#exampleID' + obj['exampleID'] + clusterContext + ' .example-highlighted-misuse').removeClass('example-highlighted-misuse');
  

  $('#exampleID' + obj['exampleID'] + clusterContext + '  .keyword-highlight').removeClass('keyword-highlight');
  $('#exampleID' + obj['exampleID'] + clusterContext + ' .boundedBox').removeClass('boundedBox');
  $('#exampleID'  + obj['exampleID'] + clusterContext + ' .match-explanation').addClass('hidden');
  $('#exampleID'  + obj['exampleID'] + clusterContext + ' span').css('background-color', '');

   


  // first, clear existing 'keyword-highlight'
  var exampleID = obj['exampleID'];


  

  var sourceSplitByLine = obj['rawCode'].split('\n');
  var lineStart = 0;
  for (var index =0; index < sourceSplitByLine.length; index ++) {
    
    if (obj['rawCodeLineNumber'] + index == obj['line']) {
      // highlight the entire line

      addSpan(exampleID, obj['clusterContext'], lineStart, lineStart + sourceSplitByLine[index].length, 'line-highlight');
    }

    // highlight source line
    if (obj['rawCodeLineNumber'] + index == obj['sourceLine']) {
      
      addSpan(exampleID, obj['clusterContext'], lineStart, lineStart + sourceSplitByLine[index].length, 'keyword-highlight');
    }

    lineStart += sourceSplitByLine[index].length + 1;

  }






  // highlight 'additional' nodes if they exist
  var additionalNodeToHighlight = obj['additionalNodeToHighlight'];
  if (additionalNodeToHighlight) {

    var expressionStart = obj[additionalNodeToHighlight]['expressionStart'];
    var expressionEnd = obj[additionalNodeToHighlight]['expressionEnd'];

    addSpan(exampleID, obj['clusterContext'], expressionStart, expressionEnd, 'keyword-highlight');
  }

  // console.log('highlight code');
  

  // if viewing inspectedPattern
  if (Session.get('inspectedPattern') == null) {
    return;
  } 
  
}


function countExamplesWithAttr(attribute, value) {
  var selector = {};
  selector[attribute] = value;
  var examples = fetchShortestExamples(selector);
  //console.log('examples', examples)
  return examples.count();

}

function getExamplesWithAttr(attribute, value) {
  var selector = {};
  selector[attribute] = value;

  /** 
  selector['pkg'] = 'com.alibaba.nacos.naming.*';
  console.log('1', fetchShortestExamples(selector).fetch());
  selector['pkg'] = 'com.alibaba.nacos.config.*';
  console.log('2', fetchShortestExamples(selector).fetch());

  var containments = Containment.find(selector).fetch();
  console.log('containments', containments);
  */

  return fetchShortestExamples(selector).fetch();
}



Template.example.onRendered(function() {
    // $('#'+this.data.exampleID + ' pre code').each(function(i, block) {
    //   hljs.highlightBlock(block);
    // });

    var that = this;
    Meteor.defer(function() {
    
      
      // hljs.highlightBlock(that.find('code.maincode'));
      that.findAll('code').forEach(function(block) {
        hljs.highlightBlock(block, { language: 'java' });
      });
      render(that['data']);
    });

    const codearea = document.getElementsByClassName('maincode-' + this['data']['exampleID'])[0];
    codearea.addEventListener('mouseup', function(e) {
      const selectedText = window.getSelection().toString(); // get text selected by the user
      if (selectedText.length) { 
        console.log("Selected text: ", selectedText);
        
        const exampleID = that['data']['exampleID'];
        const rawCode = that['data']['rawCode'];
        const selectedTextStart = rawCode.indexOf(selectedText);
        const selectedTextEnd = selectedTextStart + selectedText.length;

        // enumerate over the code elements contained in the selectedText
        const codeElements = Object.keys(that['data']);
        const selectedCodeElements = codeElements.filter(function(codeElement) {
          if (that['data'][codeElement] == undefined || that['data'][codeElement].expressionStart == undefined || that['data'][codeElement].expressionEnd == undefined) {
            return false;
          }

          // ignore UNKNOWN
          if (codeElement == 'UNKNOWN') {
            return false;
          }


          if (that['data'][codeElement].expressionEndAdditional) {
            // enumerate over expressionEndAdditional
            for (var i = 0; i < that['data'][codeElement].expressionEndAdditional.length; i++) {
              if (that['data'][codeElement].expressionStartAdditional[i]  <= selectedTextEnd &&  that['data'][codeElement].expressionEndAdditional[i] >= selectedTextStart) {
                return true;
              }
            }
          }

          // check that the selected text is within the range of the code element
          return that['data'][codeElement].expressionStart  <= selectedTextEnd &&  that['data'][codeElement].expressionEnd >= selectedTextStart;

          // return that['data'][codeElement].expressionStart  >= selectedTextStart &&  that['data'][codeElement].expressionEnd <= selectedTextEnd;
        });

        // data-value="{{patternNumber}}
    
        const selectedRuleNumber = Session.get('filterByContainment');

        var matchingRuleNumber = -1;
        for (var ruleIndex = 0; ruleIndex < MAX_RULE; ruleIndex ++) {

          var matchingExamples = computeRuleMatches(ruleIndex);
  
          var matchingExamplesId = _.map(matchingExamples, function(example) {return example.exampleID;});
  
          if (_.contains(matchingExamplesId, exampleID)) {
            matchingRuleNumber = ruleIndex;
          }
        }
      

        const isSelectable = (selectedRuleNumber != undefined && selectedRuleNumber != -1) || matchingRuleNumber != -1;
        // console.log('ruleNumber bag', ruleNumber);

        if ( selectedCodeElements.length > 0 && isSelectable) {
          console.log(selectedCodeElements);

          initializeBagOfWordsFromSelectedCode(selectedCodeElements, selectedRuleNumber ? selectedRuleNumber : matchingRuleNumber);
          showStatus('Updating Rule ' + (selectedRuleNumber ? selectedRuleNumber : matchingRuleNumber) + " with a query for the code expressions selected. Check/uncheck each code expression under the rule to modify the query.", 15);
        } else {
          if (!Session.get('isBaseline')) {
            showStatus('No rule is updated since the selected warning is not associated with any rule.', 15);
          }
        }
        
      }

      // var toCollapse = e.currentTarget.parentNode.parentNode.parentNode.parentNode.className;
      // console.log('toCollapse', toCollapse);
      // hideContents(toCollapse);
    });

    
});


function showStatus(status, hideAfterSeconds) {
  // showLoadingText();

  var statusElementText = document.querySelector('.status-box-text');
  statusElementText.textContent = status;
  var statusElement = document.querySelector('.status-box');
  statusElement.classList.remove('hidden');
  statusElement.classList.add('visible');

  if (status == '') {
    statusElement.classList.remove('visible');
    statusElement.classList.add('hidden');
  }

  if (hideAfterSeconds) {
    setTimeout(function() {
      statusElement.classList.remove('visible');
      statusElement.classList.add('hidden');
    }, hideAfterSeconds * 1000);
  }
}

function showLoadingText() {
  var loadingElement = document.querySelector('.loading-text');
  loadingElement.classList.remove('hidden');
  loadingElement.classList.add('visible');
}

function hideLoadingText() {
  var loadingElement = document.querySelector('.loading-text');
  loadingElement.classList.remove('visible');
  loadingElement.classList.add('hidden');
}



var entropy = function(subgraphLabelledPositiveMatches, subgraphLabelledNegativeMatches, defaultValue) {
  var numPositives = subgraphLabelledPositiveMatches ? subgraphLabelledPositiveMatches.length : 0;
  var numNegatives = subgraphLabelledNegativeMatches ? subgraphLabelledNegativeMatches.length : 0;
  
  var total = numPositives + numNegatives;
  if (total === 0) return defaultValue;

  var pPos = numPositives / total;
  var pNeg = numNegatives / total;

  var entropy = 0;
  if (pPos !== 0) {
    entropy -= pPos * Math.log2(pPos);
  }
  if (pNeg !== 0) {
    entropy -= pNeg * Math.log2(pNeg);
  }
  
  return entropy;
}




var computeRuleMatches = function(ruleNumber) {
  const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"];

  // fetch containment
  var containment = Containment.find({patternNumber: ruleNumber}).fetch()[0];

  var selector = {};

  if (containment) {
    // enumerate over attributes
    for (var i = 0; i < attributes.length; i++) {
      if (containment[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': containment[attributes[i]] };
        } else if (!containment[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = containment[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': containment[attributes[i]][0], '$options': 'i' };
        }
      }
    }
  }

  // account for the bag-of-words refinements
  const refinement = Refinements.find({ruleNumber: ruleNumber}).fetch()[0];
  if (refinement) {
    // take difference of selectedNodes and disabledWords
    var selectedNodes = _.difference(refinement.selectedNodes, refinement.disabledWords);

    selectedNodes.forEach(node => {
      selector[node] = {'$exists': true};
    });
  }

  if (!containment && !refinement) {
    // nothing to match
    return [];
  }
  
  return fetchShortestExamples(selector).fetch();
}

var clearMatchedByCache = function() {
  for (var ruleIndex = 0; ruleIndex < MAX_RULE; ruleIndex ++) {

 
      Session.set("cacheRuleMatches" + ruleIndex, undefined);
    
  }
}

Template.node.nodeRendered = function(subgraphs) {
  if (subgraphs == undefined) return;

  Meteor.defer(function () {

    // colorSubgraphNodeSelection(subgraphs);
  });
}



/*
 * Register the helper functions for the body template
 */
Template.body.helpers({

  selectedIfBaseline() {
    return Session.get('isBaseline') ? 'selected' : '';
  },
  selectedIfNotBaseline() {
    return !Session.get('isBaseline') ? 'selected' : '';
  },



  emptyText(collection) {
    return collection.length == 0 ? 'None' : '';
  } ,
  


  topContainmentPatterns() {
    
    
    var containments = Containment.find({}).fetch();
  // fetch countExamplesWithAttr for each containment
  containments.forEach(function(containment) {
    if (containment.name) {
      containment.countExamplesWithAttr = countExamplesWithAttr('name', containment.name);
    }
    if (containment.type) {
      containment.countExamplesWithAttr = countExamplesWithAttr('type', containment.type);
    }
    if (containment.pkg) {
      containment.countExamplesWithAttr = countExamplesWithAttr('pkg', containment.pkg);
    }
    if (containment.retType) {
      containment.countExamplesWithAttr = countExamplesWithAttr('retType', containment.retType);
    }
    if (containment.fieldUsed) {
      containment.countExamplesWithAttr = countExamplesWithAttr('fieldsUsed', containment.fieldsUsed);
    }
  });

  // sort by countExamplesWithAttr
  containments.sort(function(a, b) {
    return b.countExamplesWithAttr - a.countExamplesWithAttr;
  });

  return containments;
  },
  


  viewedTraces() {
    var exampleID = Session.get('traceExample');
    if (!exampleID) return [];
    var example = Examples.findOne({'exampleID': parseInt(exampleID)});
    Meteor.defer(function() {
      hljs.highlightBlock($('#viewTraceModal').find('code'), { language: 'java' });
    });
    return example.combined_records;
  },  
  queryExamples(){
    
    // console.log('fetching query examples');

    // return Examples.find({'query': true});

    // temp
    var examples = Examples.find({'graphId': {'$exists': true}, 'query': true}).fetch();
    examples.forEach(function(example) {
      example.clusterContext = 'query';
      Meteor.defer(function() {
        // log the json keys
        //console.log(Object.keys(example));
        render(example);
      });
    });
    return examples;  

    // user study
    // var examples = Examples.find({'label': {'$ne': '?'}}).fetch();

    // examples.sort(function(a, b) {
    //   if (a['prelabelled'] && !b['prelabelled']) {
        
    //     return -1;
    //   }
    //   if (!a['prelabelled'] && b['prelabelled']) {
    //     return 1;
    //   }

    //   if (a['prelabelled'] && b['prelabelled']) {
    //     // sort by their label, first show positive, then negative, then '?'
    //     if (a['label'] === 'positive' && b['label'] !== 'positive') {
    //       return -1;
    //     }
    //     if (a['label'] !== 'positive' && b['label'] === 'positive') {
    //       return 1;
    //     }
    //     if (a['label'] === 'negative' && b['label'] !== 'negative') {
    //       return -1;
    //     }
    //     if (a['label'] !== 'negative' && b['label'] === 'negative') {
    //       return 1;
    //     }
    //     return 0;
    //   } else {
    //     // sort by exampleID
    //     return a['exampleID'] - b['exampleID'];
    //   }
    // });

    // return examples;
  },
  baselineExamples() {

    
    var examples = fetchShortestExamples({}).fetch();

    // include unlabelled examples
    examples = examples.concat(Examples.find({'label': '?'}).fetch());

    // examples.forEach(function(example) {
    //   example['clusterContext'] = 'baseline';
    // }
    // );
    // sort the examples.
    // first, show the prelabelled data
    // then sort by their label, first show positive, then negative, then '?'
    examples.sort(function(a, b) {
      if (a['prelabelled'] && !b['prelabelled']) {
        
        return -1;
      }
      if (!a['prelabelled'] && b['prelabelled']) {
        return 1;
      }

      if (a['prelabelled'] && b['prelabelled']) {
        // sort by their label, first show positive, then negative, then '?'
        if (a['label'] === 'positive' && b['label'] !== 'positive') {
          return -1;
        }
        if (a['label'] !== 'positive' && b['label'] === 'positive') {
          return 1;
        }
        if (a['label'] === 'negative' && b['label'] !== 'negative') {
          return -1;
        }
        if (a['label'] !== 'negative' && b['label'] === 'negative') {
          return 1;
        }
        return 0;
      } else {
        // sort by exampleID
        return a['exampleID'] - b['exampleID'];
      }
    });

    examples.forEach(function(example) {
      example['clusterContext'] = 'baseline';
      // cluster['patternNumber'] = patternNumber;
      Meteor.defer(function() {
        render(example);
      });
    });

    return examples;

  },


  openaiExamples(){
    return Queries.find({});

  },

  
  
  currentFilters() {

    var filterByContainment = Session.get('filterByContainment');

    var text = '';
    if (filterByContainment != null) {

      const rule = Containment.find({  patternNumber: parseInt(filterByContainment)}).fetch()[0];
      var containmentText =  (rule.ruleName ? rule.ruleName : rule.patternNumber);

      var filterByLabel = Session.get('filterByLabel');
      var labelText = '';
      if (filterByLabel == 'positive') {
        labelText = '(False positives only)';
      } else if (filterByLabel == 'negative') {
        labelText = '(True warnings only)';
      } else if (filterByLabel == '?' ) {
        labelText = '(Uninspected warnings only)';
      } else {
        labelText = '';
      }

      var ruleComponentText = ''
      var filterByRuleComponent = Session.get('filterByRuleComponent');
      if (filterByRuleComponent != null) {
        ruleComponentText += ' (' 
        if (filterByRuleComponent == 'containment-only') {
          ruleComponentText += 'Containment only';
        } else if (filterByRuleComponent == 'code-only') {
          ruleComponentText += 'Code query only';
        }
        ruleComponentText += ')';
      }

      return 'Rule ' +  containmentText + ' ' + ruleComponentText + ' ' + labelText;
    }

    if (text == '') {
      return 'None (Showing uninspected warnings)';
    }

    
  },
  hideFilterRelatedButtonIfNoFilter() {

        var filterByContainment = Session.get('filterByContainment');
      
        // if no filter
        // hide
        if (filterByContainment == null) {
          return 'hidden';
        } else {
          return '';
        }
  },

  queryExamplesCount() {
    return Examples.find({'query': true, 'graphId': {'$exists': true}}).count();

  },
  
  isActive(mode) {
    return Session.get('view') === mode ? 'active' : '';
  },

  allOrMatchingText() {
    return hasSelectedPatternInPalette()? 'Matching' : 'All';
  },

  isActiveOrHiddenByLabel(mode) {
    // if no example is labelled yet, hide the buttons
    if (Examples.find({label: {$in: ['positive', 'negative']}}).count() === 0) return 'invisible';
    if (mode === '') return '';
    
    return Session.get('view') === mode ? 'active' : '';
  },
  currentKeyword() {
    return Session.get('keyword');
  },
  subgraphsMined() {
    var subgraphs = Subgraphs.find().fetch();
    return subgraphs;
  },
  topologicalSortNodesOfMinedDiscriminativeSubgraphs() {

    var subgraphs = Subgraphs.find({ '$and' : 
      [
        {'discriminative': true},  
        {'patternNumber': 0},
        {'hidden': {'$ne': true}}
      ]
    }).fetch();

    
    // var sortedNodes = sortNodes(subgraphs);
    var sortedNodes = sortNodesFromEdges(subgraphs);


    
    return sortedNodes;
  },
  topologicalSortNodesOfAlternativeDiscriminativeSubgraphs() {
    var subgraphs = Subgraphs.find({'alternative': true}).fetch();


    console.log('alternative subgraphs', subgraphs);

    var sortedNodes = sortNodes(subgraphs);

    console.log('sortedNodes [topologicalSortNodesOfAlternativeDiscriminativeSubgraphs]', sortedNodes);
    return sortedNodes;

  },



  count() {

    return "is this used anywhere?"
  },
  

});

/*
 * Register the helper functions for the breadcrumb template
 */
Template.breadcrumb.helpers({
  shortName(filterType){
    var selector = Session.get('selector');
    var filterValue = selector[filterType];
    if (!_.isEmpty(filterValue)) {
      if (typeof filterValue === 'string' && filterValue !== 'dataset') {
        console.log('filterValue is string');
        return 'must have '+filterValue;
      } else if (Object.keys(filterValue)[0] === '$ne'){
        switch(filterType) {
          case "initialization":
            return "some declarations";
            break;
          case "try":
            return 'a try block';
            break;
          case "configuration":
            return "some config";
            break;
          case 'guardType':
            return "some guard type"
            break;
          case 'guardCondition':
            return 'some guard condition';
            break;
          // case 'focalAPI':
          //   return "the API call of interest";
          //   break;
          case 'checkType':
            return 'a control structure for results';
            break;
          case 'followUpCheck':
            return 'some result checking';
            break;
          case 'use':
            return 'some use calls';
            break;
          case 'exceptionType':
            return 'some exception caught';
            break;
          case 'exceptionHandlingCall':
            return 'some exception handling';
            break;
          // case 'finally':
          //   return 'finally block';
          //   break;
          case 'cleanUpCall':
            return 'some clean up';
            break;
          default:
            return '';
        }
      } else if (Object.keys(filterValue)[0] === '$all'){
        switch(filterType) {
          case "initialization":
            return "all these declaration(s): " + filterValue['$all'].join();
            break;
          // case "try":
          //   return 'API call in a try block';
          //   break;
          case "configuration":
            return "all this config: " + filterValue['$all'].join();
            break;
          // case 'guardType':
          //   return "control structure enclosing the API call" + filterValue['$all'].join();
          //   break;
          // case 'guardCondition':
          //   return 'at least one condition guarding execution of the API call' + filterValue['$all'].join();
          //   break;
          // case 'focalAPI':
          //   return "the API call of interest";
          //   break;
          // case 'checkType':
          //   return 'control structure interacting with the API call results';
          //   break;
          // case 'followUpCheck':
          //   return 'at least one condition checking the results';
          //   break;
          case 'use':
            return 'all these uses: ' + filterValue['$all'].join();
            break;
          case 'exceptionType':
            return 'all these exception(s) caught: ' + filterValue['$all'].join();
            break;
          case 'exceptionHandlingCall':
            return 'all these call(s) handling exceptions: '+ filterValue['$all'].join();
            break;
          // case 'finally':
          //   return 'finally block';
          //   break;
          case 'cleanUpCall':
            return 'all these clean-up calls: '+ filterValue['$all'].join();
            break;
          default:
            return '';
        }
      }
    }
  },
});


/*
 * Register the event listeners on the body template
 */
Template.body.events({
  'click .collapsible': function(event, template) {
      // get the id of the collapsible button
      var id = event.target.id;
      // get the number after collapsibleButton (collapsibleButton0: get 0 here)
      var number = id.match(/\d+/)[0];
      toggleContents('content'+ number);
    },
    'click .status-box-close' (event, instance) {
      var statusElement = document.querySelector('.status-box');
      statusElement.classList.remove('visible');
      statusElement.classList.add('hidden');  
    },
  'mouseenter .example-cluster' (event, instance) {
    var role = $(event.target).attr('data-cluster');
    // $('.example-cluster[data-cluster="'+role+'"]').addClass('has_border');

  },
  'mouseleave .example-cluster' (event, instance) {
    var role = $(event.target).attr('data-cluster');
    // $('.example-cluster[data-cluster="'+role+'"]').removeClass('has_border');
  },
  'change #participant_id' (event, instance) {

    var participantId = $(event.target).val();
    Session.set('subjectNum', participantId);
    updateParticipantID(participantId);

  },
  'change #change-tool' (event, instance) {
    var tool = $(event.target).val();

    Session.set('isBaseline', tool == 'baseline');
  },
  'click .change-dataset'(event, instance){
    console.log('API Change')
    // Session.set('dataset', 'get');
  },
  'click .hide-user-study-config'(event, instance){
    $('.user-study-config').hide();

    // set timeout to show the config again
    setTimeout(function() {
      $('.user-study-config').show();
      $('.end-task-btn').addClass('btn-primary');
      $('.end-task-btn').removeClass('disabled hidden');
      $('.end-task-btn').css('height', '40px');

      $(".task-message").addClass('hidden');
      $(".user-study-instructions").addClass('hidden');
      $(".participant-id-text").addClass('hidden');
      $(".user-study-config input").addClass('hidden disabled');
      $(".user-study-config select").addClass('hidden disabled');
      $('.hide-user-study-config').addClass('hidden disabled');
      $('.hide-user-study-config').removeClass('btn-primary');
      $('.task-message').removeClass('hidden');
    }, 1000 * 60 * 10.5); // 10 minutes + some extra time
  },
  'click .collapse-control' (event, instance) {
    var target = $(event.target).attr('data-target');

    $(target).collapse('toggle');
    $(target).addClass('show');
    $(target).css('height', 'auto');

  },
  'click .toggle-collapse'(event,instance){
    // console.log('.toggle-collapse clicked',event.target)
    var hideOptions = Session.get('hideOptions');
    $('.collapse').show();
    if (hideOptions){
      $('.collapse').collapse('show');
      Session.set('hideOptions',false);
    } else {
      $('.collapse').collapse('hide');
      Session.set('hideOptions',true);
    }
  },
  'click .end-task-btn'(event, instance){
    Session.set('taskComplete', true);

    $('#taskCompleteModal').modal('show');;

    endTask();


  },
  'change #inspectedPattern' (event, instance) {
    var inspectedPattern = parseInt($(event.target).val());
    Session.set('inspectedPattern', inspectedPattern);

    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', false);
  },
  'change #match-source-sink'  (event, instance) {

    Session.set('matchSink', $(event.target).val() == 'sink');
  },
  'change #label-features-or-examples' ( event, instance ) {
    
    Session.set('isLabelByExample', $(event.target).val() == 'examples');
  },
  'change .example-explanation' (event, instance) {
    var exampleId = $(event.target).attr('data-example');
    var explanation = $(event.target).val();

    updateExplanation(exampleId, explanation, !Session.get('isBaseline'));

  },
  'click .show-all' (event, instance) {
    inspectExamples('unmatching', -1);
    
    Session.set('filterByContainment', null);

    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', true);

  },
  'click .show-unmatching' (event, instance) {
    inspectExamples('unmatching', -1);
    

    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', true);
  },
  'click .show-unmatching-spare-button' (event, instance) {
    inspectExamples('unmatching', -1);
    
    Session.set('filterByContainment', null);

    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', true);
  },
  'click .show-matching' (event, instance) {
    var patternNumber = parseInt($(event.target).attr('data-pattern-number'));
    inspectExamples('matching', patternNumber);
    
    Session.set('filterByContainment', null);

    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', true);

  },
  'click .show-feature-matching' (event, instance) {
    var node = $(event.target).attr('data-node');
    inspectExamples('feature-matching', node);
    Session.set('filterByNode', node);
    Session.set('filterByPseudoLabel', null);
    Session.set('filterByPattern', null);
    Session.set('filterByContainment', null);

    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', false);

  },
  'click .show-pseudolabel-matching' (event, instance) {
    var pseudolabel = $(event.target).attr('data-pseudolabel');
    inspectExamples('pseudolabel-matching', pseudolabel);
    Session.set('filterByPseudoLabel', pseudolabel);
    Session.set('filterByNode', null);
    Session.set('filterByPattern', null);
    Session.set('filterByContainment', null);

    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', true);
  },
  'click .show-recently-added-pattern' (event, instance) {

    var patternNumber = parseInt($(event.target).attr('data-pattern-number'));
    inspectExamples('matching', patternNumber);
    Session.set('filterByPattern', patternNumber);
    Session.set('filterByPseudoLabel', null);
    Session.set('filterByNode', null);
    Session.set('filterByContainment', null);

    Session.set('inspectedPattern', patternNumber);

    Session.set('viewPatternIndicator', false);
  },
  'click. .show-containment' (event, instance) {

    var selector = $(event.target).attr('data-containment');
    if (selector ) {
      selector = JSON.parse(selector);
    }
    console.log('data-containment', $(event.target).attr('data-containment'));
    if (!selector) {
      selector = {}
    }


    var value = $(event.target).attr('data-value');
    console.log('data-value', $(event.target).attr('data-value'));

    // check if a label is provided
    var label = $(event.target).attr('data-label');
    if (label) {
      selector['label'] = label;
    }

    inspectExamples(JSON.stringify(selector), value);
    
    Session.set('filterByPattern', null);
    Session.set('filterByPseudoLabel', null);
    Session.set('filterByNode', null);
    Session.set('filterByContainment', $(event.target).attr('data-rule-number'));
    Session.set('filterByLabel', label)
    Session.set('filterByRuleComponent', $(event.target).attr('data-rule-component'));


    Session.set('viewPatternIndicator', false);
    Session.set('viewExampleIndicator', false);

  },
  'change .rule-name-input' (event, instance) {
    var ruleName = $(event.target).val();

    var ruleNumber = $(event.target).attr('data-rule-number');

    // updateRuleName = function(ruleNumber, ruleName, nextFunction)
    updateRuleName(ruleNumber, ruleName, function() {
      console.log('ruleName updated');
      // selector gets the ruleName from database
      selector = {'patternNumber': parseInt(value)};

      const rule = Containment.find(selector).fetch()[0];
      console.log('rule', rule);
      Session.set('globalRuleNumber', value);


    });

  },
  'click .show-uninspected-matches-conj' (event, instance) {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};
    var value = $(event.target).attr('data-value');
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
        
      }
    }
    
    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    console.log(selector);

    selector['label'] = '?';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },
  'click .show-suppressed-matches-conj' (event, instance) {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};
    var value = $(event.target).attr('data-value');
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
        
      }
    }
    
    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    console.log(selector);

    selector['label'] = 'positive';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },
  'click .show-inspected-matches-conj' (event, instance) {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};
    var value = $(event.target).attr('data-value');
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
        
      }
    }
    
    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    console.log(selector);

    selector['label'] = 'negative';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },
  'click .show-uninspected-matches' (event, instance) {
    var value = $(event.target).attr('data-value');
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    selector['label'] = '?';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },
  'click .show-suppressed-matches' (event, instance) {
    var value = $(event.target).attr('data-value');
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    selector['label'] = 'positive';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },
  'click .show-inspected-matches' (event, instance) {
    var value = $(event.target).attr('data-value');
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    selector['label'] = 'negative';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },
  'click .show-suppressed-matches-word' (event, instance) {
    var selector = {};

    // account for the bag-of-words refinements
    var value = $(event.target).attr('data-value');
    value = parseInt(value);
    const refinement = Refinements.find({ruleNumber: value}).fetch()[0];
    console.log('ruleNumber', value);
    console.log('refinement', refinement);
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
      console.log('selector', selector);
    }

    selector['label'] = 'positive';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },

  'click .show-inspected-matches-word' (event, instance) {
    var selector = {};

    // account for the bag-of-words refinements
    var value = $(event.target).attr('data-value');
    value = parseInt(value);
    const refinement = Refinements.find({ruleNumber: value}).fetch()[0];
    console.log('ruleNumber', value);
    console.log('refinement', refinement);
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
      console.log('selector', selector);
    }

    selector['label'] = 'negative';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },
  'click .show-uninspected-matches-word' (event, instance) {
    var selector = {};

    // account for the bag-of-words refinements
    var value = $(event.target).attr('data-value');
    value = parseInt(value);
    const refinement = Refinements.find({ruleNumber: value}).fetch()[0];
    console.log('ruleNumber', value);
    console.log('refinement', refinement);
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
      console.log('selector', selector);
    }
    console.log('examples', Examples.find().fetch());

    selector['label'] = '?';
    selector = JSON.stringify(selector);
    inspectExamples(selector, value);
  },

  'click .suppress-containment' (event, instance) {
    var selector = $(event.target).attr('data-containment');
    if (!selector) {
      selector = '{}'
    }
    var value = $(event.target).attr('data-value');
    var ruleNumber = $(event.target).attr('data-rule-number');
    var words = $(event.target).attr('data-words');

    clearMatchedByCache();
    suppressContainment(selector, ruleNumber, words);
  },
  'click .inspect-containment' (event, instance) {
    var selector = $(event.target).attr('data-containment');
    if (!selector) {
      selector = '{}'
    }
    var value = $(event.target).attr('data-value');
    var ruleNumber = $(event.target).attr('data-rule-number');
    var words = $(event.target).attr('data-words');

    clearMatchedByCache();
    inspectContainment(selector, ruleNumber, words);
  },
  'click .infer-pattern-from-containment' (event, instance) {
    var containmentType = $(event.target).attr('data-containment');
    var value = $(event.target).attr('data-value');

    inferPatternFromContainment(containmentType, value);
  },
  'click .reset-pattern-btn' (event, instance) {
    var subgraphs = Subgraphs.find({ '$and' : 
      [
        {'discriminative': true},  
        {'patternNumber': 0},
        {'hidden': {'$ne': true}},
        {'$or': [{ 'bags': { '$exists': false } }, { 'bags': { $eq: null } }]}
      ]
    }).fetch();

    console.log('subgraphIds (the server recomputes this data though)' + subgraphs.map((subgraph) => subgraph._id));    
    deleteDiscriminativeSubgraphs();
    // delete the subgraphs
    
  },
  'click .reset-labels-btn' (event, instance) {
    // reset the labels on all examples
    resetLabels();
    console.log('reset labels');

  },
  'click .reset-all-btn' (event, instance) {

    deleteDiscriminativeSubgraphs();
    resetLabels();
    console.log('reset all!');
  },

  'click .reset-state-btn' (event, instance) {
    resetState(); // reset 

    showStatus('Restarting task... When the right panel has cleared, click on "Bootstrap Pattern" to start again');
    showLoadingText();
  },
  'click .decision-btn'(event, instance) {
    var label = $(event.target).attr('data-option');
    var exampleId = $(event.target).attr('data-button-name').split('--')[1];
    var methodName = $(event.target).attr('data-method-name');

    // var ruleName = exampleId;
    // console.log('ruleName inside dec btn', );
    // Session.set('globalRuleNumber', ruleName);

    // count number of patterns
    Session.set('numPatternsCounted', getTopPatternIds().length);
    
    var triggerMining = true;
    if (Session.get('isBaseline')) {
      triggerMining = false;
    }

    
    updateLabels(exampleId, methodName, label, Session.get('keyword'), Session.get('matchSink'), triggerMining, function() {
    });

    // get the name of the button
    var buttonName = $(event.target).attr('id');
    console.log('buttonName', buttonName);
    // if the name is decisionBtnTPx where x is a number
    if(buttonName.includes('decisionBtnTP')) {
      // get the number
      var toCollapse = event.currentTarget.parentNode.parentNode.className;
      console.log('toCollapse', toCollapse);
      hideContents(toCollapse);
    }
  },

  'click .viewTraceModalButton' (event, instance) {
    var exampleId = $(event.target).attr('data-example-id');
    Session.set('traceExample', exampleId);
    
    $('#traceModal').modal('show');
  },
  
  'click .common-package' (event, instance) {

    var pkgId = $(event.target).attr('data-id');

    var isChecked = $(event.target).prop('checked');
    
    updatePackage(pkgId, isChecked);

  },
  'click .common-classname' (event, instance) {
    var classNameId = $(event.target).attr('data-id');

    var isChecked = $(event.target).prop('checked');

    updateClassname(classNameId, isChecked);
  },
  'click .common-subtype' (event, instance) {
    var subtypeId = $(event.target).attr('data-id');

    var isChecked = $(event.target).prop('checked');
    
    updateSubtype(subtypeId, isChecked);

  },

  'click .word-refinement' (event, instance) {
    // check is checked
    var isChecked = $(event.target).prop('checked');
    var word = $(event.target).attr('data-value');
    var ruleNumber = $(event.target).attr('data-rule-number');

    updateWordRefinement(word, ruleNumber, isChecked);

  },

 
  'click .open-label-query-examples-modal' (event, instance) {
    // computeQueryExamples();
    updateLabels(-1, '', '', '', Session.get('matchSink'), !Session.get('isBaseline'));
  },

  'click .open-openai-examples-modal' (event, instance) {
    getOpenaiCompletion(function() {});

  },
  'click .infer-pattern-btn' (event, instance) {      
    inferPatterns();

    // $('#labelQueryExamplesModal').modal('hide');

    var isBaseline = Session.get('isBaseline');
    
    if (!isBaseline) {
      // showStatus('Inferring the most general pattern. Once the pattern appears, provide feedback by checking the "Suggest" checkboxes. A checkmark means the feature should be considered when "Reinfer Pattern" is clicked');
    }else{ 
      // showStatus('Inferring the most general pattern. Once the pattern appears, click on "View and label matching examples" to label more examples.');
    }
    hideLoadingText();
  },
 
  'click .baseline-infer-pattern-btn' (event, instance) {
    
    inferPatterns();

    $('#labelAllExamplesModal').modal('hide');
    // showStatus('Inferring a pattern... Once the pattern appears, you can end the task by clicking on "End Task".');
    Session.set('taskComplete', true);

    $('#taskCompleteModal').modal('show');;

    endTask();
  },
});

/*
 * Declare the dictionary of global helper functions, where key is the function name and value is the function body
 */
var helpers = {
  conditionalCountBlockRow: function(blockname) {
    var selector = Session.get('selector');
    if ( _.isEmpty(selector) ) {
      return fetchAndCountExamples(selector); 
    } else {
      //if we're not already filtering for an element in this block
      //then filter for it
      if (!selector[blockname]) {
        //is it a checkbox-block or a radio-button block?
        if (!_.isEmpty(_.find(option_lists, function(list_type){ return list_type===blockname;}))){
          selector[blockname] = {$ne: []};
        } else {
          selector[blockname] = {$ne: 'empty'};
        }
      }
      var conditionalCount = fetchAndCountExamples(selector);
      return conditionalCount;
    }
  },
  hideLabels: function(){
    // console.log(Session.get('hideLabels'));
    return Session.get('hideLabels');
  },
  blockStyle: function(blockname) {
    // return "inherit";
    return "";
  },
  countBlock: function(blockname) {
    var selector = {};
    if (!_.isEmpty(_.find(option_lists, function(list_type){ return list_type===blockname;}))){
      selector[blockname] = {$ne: []};
    } else {
      selector[blockname] = {$ne: 'empty'};
    }
    return fetchAndCountExamples(selector);
  },
  count: function(optionname) {
    var selector = {};
    return fetchAndCountExamples(selector);
  },

  positiveCount: function(optionname) {
    // var parentData = Template.parentData();
    var selector = {'dataset': Session.get('dataset'), 'label' : 'positive' };
    
    return fetchAndCountExamples(selector);
  },
  negativeCount: function(optionname) {
    // var parentData = Template.parentData();
    var selector = {'dataset': Session.get('dataset'), 'label' : 'positive' };
    
    return fetchAndCountExamples(selector);
  },
  exampleType: function() {
    var viewType = Session.get('view');
    
    if (viewType === 'all') {
      return 'remaining';

    } else if (viewType === 'matching') {
      return 'matching';

    } else if (viewType == 'unlabelled') {
      return 'unlabelled';
    } else if (viewType == 'labelled') {
      return 'labelled';
    } else if (viewType === 'confused') {
      return 'mislabelled';
    } else if (viewType === 'not-matching') {
      return 'uncovered';
    }
  },
 
  matchingText: function() {
    var keyword = Session.get('keyword');
    var viewType = Session.get('view');
    
    if (keyword && viewType == 'matching') {
      return 'matching "' + keyword + '" and the Palette';
    }
    
    if (keyword) {
      return 'matching "' + keyword + '"';
    } 
    if (viewType == 'matching') {
      return 'matching the Palette';
    }
  },



  
 
  recallOnTestSet: function(){

    // 
    // return TestExamples.find(selector).count() / TestExamples.find().count() * 100;
  },

  methodName: function(rawCode) {
    
    var firstline = _.first(
      _.filter(rawCode.split(' '), function(item){ return item.includes('(')  })
    )
    return firstline.split('(')[0];
  },

  isCorrectUseChecked: function(label) {
    return label == 'positive';
  },
  isMisuseChecked: function(label) {
    return label == 'negative';
  },
  checkedIfPositiveLabel: function(obj) {
    return obj.label == 'positive' ? 'checked' : '';
  },
  checkedIfNegativeLabel: function(obj) {
    return obj.label == 'negative' ? 'checked' : '';
  },
  checkedIfPackageSelected: function(obj) {
    return obj.selected? 'checked' : '';
  },
  checkedIfSubtypeSelected: function(obj) {
    return obj.selected ? 'checked' : '';
  },
  checkedIfNotDisabled: function() {
    const refinement = Refinements.find({ruleNumber: this.ruleNumber}).fetch()[0];
    return refinement.disabledWords?.includes(this.word) ? '' : 'checked';
  },

  showIfMatchSourceClass: function(obj) {
    return Session.get('matchSink') ? 'hide' : 'show'; 
  },
  showIfMatchSourceStyle: function(obj) {
    return Session.get('matchSink') ? '' : 'auto;'; 
  },
  showIfMatchSinkClass: function(obj ) {
    return !Session.get('matchSink') ? 'hide' : 'show'; 
  },
  showIfMatchSinkStyle: function(obj) {
    return !Session.get('matchSink') ? '' : 'auto;'; 
  },
  showIfPositiveLabel: function(obj) {
    return obj.label == 'positive' ? '' : 'visibility:hidden';
  },
  showIfNegativeLabel: function(obj) {
    return obj.label == 'negative' ? '' : 'visibility:hidden';
  },
  showIfUnlabelled: function(obj) {
    return obj.label == '?' ? '' : 'visibility:hidden';
  },
  readableExampleId: function() {
    return this.readableExampleID;
  },
  matchByRuleText: function() {
    if (Session.get('filterByContainment')) {
      // return Session.get('filterByContainment');
      selector = {'patternNumber': parseInt(Session.get('filterByContainment'))};
      const rule = Containment.find(selector).fetch()[0];
      
      return "(Matched by Rule " + (rule.ruleName ? rule.ruleName : rule.patternNumber) + ")";
    }
    // determine which rule matches
    for (var ruleIndex = 0; ruleIndex < MAX_RULE; ruleIndex ++) {

        var matchingExamples = computeRuleMatches(ruleIndex);

        var matchingExamplesId = _.map(matchingExamples, function(example) {
          return example.exampleID;
        });

      // see if matchingExamples contains this
      if (_.contains(matchingExamplesId, this.exampleID)) {
        selector = {'patternNumber': parseInt(ruleIndex)};
        const rule = Containment.find(selector).fetch()[0];
      
        return "(Matched by Rule " + (rule.ruleName ? rule.ruleName : rule.patternNumber) + ")";
      }
    }
    
    return "";
  },
  onlyRuleName: function() {   
    selector = {'patternNumber': parseInt(this.patternNumber)};
    const rule = Containment.find(selector).fetch()[0];
    return (rule.ruleName ? rule.ruleName : rule.patternNumber);
  },
  removeDuplicates: function(array) {
    return _.uniq(array);
  },
  showExtendsIfHasAncestry: function(ancestry) {
    return ancestry?.length > 0 ? ' extends ' : '';
  },

  wordsForRule() {
    const ruleNumber = this.patternNumber;
    if (Refinements.find({ruleNumber: ruleNumber}).count() > 0) {
      const refinements = Refinements.find({ruleNumber: ruleNumber}).fetch()[0];

      return _.map(refinements.selectedNodes, function(node) {

        return {
          word: node,
          ruleNumber: ruleNumber
        };

      });
    }

    return [];
  },

  selectorOfExamplesWithAttrs() {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};
    
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }
    return JSON.stringify(selector);

  },
  selectedWords() {
    const ruleNumber = this.patternNumber;
    if (Refinements.find({ruleNumber   : ruleNumber}).count() > 0) {
      const refinements = Refinements.find({ruleNumber: ruleNumber}).fetch()[0];
      const disabled = refinements.disabledWords;
      const selected = refinements.selectedNodes;
      // return selected - disabled;
      return _.difference(selected, disabled);
    }
    return [];

  },
  hasContainmentRelationAndSelectedWords() {
    const ruleNumber = this.patternNumber;

    var hasContainment = false
    if (Containment.find({patternNumber: ruleNumber}).count() > 0) {
      // check if any of ancestry, classname, fieldsUsed, pkg, retType are non-empty
      hasContainment = _.some(this, function(value, key) {
        return ["ancestry", "classname", "fieldsUsed", "pkg", "retType"].includes(key) && value.length > 0;
      });
    }

    var hasSelectedWords = false;
    if (Refinements.find({ruleNumber   : ruleNumber}).count() > 0) {
      const refinements = Refinements.find({ruleNumber: ruleNumber}).fetch()[0];
      const disabled = refinements.disabledWords;
      const selected = refinements.selectedNodes;
      
      
      hasSelectedWords = _.difference(selected, disabled).length > 0
      
    }

    return hasContainment && hasSelectedWords;
  },

  countExamplesWithAttrs() {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};
    
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        selector[attributes[i]] = this[attributes[i]][0];
      }
    }
    return fetchShortestExamples(selector).count();

  },


  countSuppressedExamplesWithAttrsRegex() {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
        
      }
    }
    
    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    console.log(selector);

    selector['label'] = 'positive';
    return fetchShortestExamples(selector).count();

  },

  countInspectedExamplesWithAttrsRegex() {

    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"];
    var selector = {};
  
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }
    console.log(selector);
  
    // Assuming a different label or additional criteria for "inspected"
    selector['label'] = 'negative'; // Adjust based on actual criteria
    return fetchShortestExamples(selector).count(); // Assuming a different function to fetch inspected examples
  },

  countExamplesWithWords() {
    
    var selector = {};

    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    return fetchShortestExamples(selector).count();
  },
  countSuppressedExamplesWithAttrsWithoutWordsRegex() {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    selector['label'] = 'positive';
    return fetchShortestExamples(selector).count();

  },
  countInspectedExamplesWithAttrsWithoutWordsRegex() {

    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    selector['label'] = 'negative';
    return fetchShortestExamples(selector).count();
  },

  countSuppressedExamplesWithWords() {
    var selector = {};

    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    selector['label'] = 'positive';
    return fetchShortestExamples(selector).count();
  },

  countInspectedExamplesWithWords() {

    var selector = {};

    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    selector['label'] = 'negative';
    return fetchShortestExamples(selector).count();
  },


  countExamplesWithAttrsRegex() {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"];

    var selector = {};
    // enumerate over attributes
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }
    
    return fetchShortestExamples(selector).count();

  },
  countUninspectedExamplesWithAttrsWithoutWordsRegex() {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"];
    var selector = {};
    // enumerate over attributes
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    var total = fetchShortestExamples(selector).count();

    selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    selector['label'] = 'positive';
    var TP = fetchShortestExamples(selector).count();

    selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    selector['label'] = 'negative';
    var TW = fetchShortestExamples(selector).count();

    return total - TP - TW;
  },
  countExamplesWithAttrsWithoutWordsRegex() {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"];

    var selector = {};
    // enumerate over attributes
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    return fetchShortestExamples(selector).count();
  },
  countUninspectedExamplesWithWords() {
    var selector = {};

    // account for the bag-of-words refinements
    var refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    var total = fetchShortestExamples(selector).count();
    selector = {};

    // account for the bag-of-words refinements
    refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    selector['label'] = 'positive';
    var TP = fetchShortestExamples(selector).count();

    selector = {};

    // account for the bag-of-words refinements
    refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    selector['label'] = 'negative';
    var TW = fetchShortestExamples(selector).count();

    return total - TP - TW;
  },

  countLabelledExamplesWithAttrsRegexWidth(label) {
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"];
    var selector = {};
    // enumerate over attributes
    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
      }
    }

    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    var denominator = fetchShortestExamples(selector).count();
    if (label != 'positive' && label != 'negative') {
      // in this case, the numerator is whatever is not labelled positive or negative
      selector['$and'].push({ 'label': {'$ne': 'positive' }}) 
      selector['$and'].push({ 'label': {'$ne': 'negative' }});
    } else {
      selector['label'] = label;
    }
    var numerator = fetchShortestExamples(selector).count();

    // return percentage
    return (100 * numerator / denominator).toFixed(2);

  },
  countLabelledExamplesWithWordsWidth(label) {
    var selector = {};

    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    var denominator = fetchShortestExamples(selector).count();
    if (label != 'positive' && label != 'negative') {
      // in this case, the numerator is whatever is not labelled positive or negative
      selector['$and'] = [];
      selector['$and'].push({ 'label': {'$ne': 'positive' }})
      selector['$and'].push({ 'label': {'$ne': 'negative' }});
    } else {
      selector['label'] = label;
    }
    var numerator = fetchShortestExamples(selector).count();

    // return percentage
    return (100 * numerator / denominator).toFixed(2);
  },
  countLabelledExamplesWidth(label) {
    var selector = {};
    var denominator = fetchShortestExamples(selector).count();

    if (label != 'positive' && label != 'negative') {
      selector = {};
      // in this case, the numerator is whatever is not labelled positive or negative
      selector['$and'] = [];
      selector['$and'].push({ 'label': {'$ne': 'positive' }}) 
      selector['$and'].push({ 'label': {'$ne': 'negative' }});
    } else {
      selector = {};
      selector['label'] = label;
    }
    var numerator = fetchShortestExamples(selector).count();

    // return percentage
    return (100 * numerator / denominator).toFixed(2);

  },
  countUninspectedExamplesWithAttrsRegex(){
    const attributes = ["classname", "pkg", "ancestry", "fieldsUsed", "retType"]
    var selector = {};

    for (var i = 0; i < attributes.length; i++) {
      if (this[attributes[i]].length > 0) {
        if (attributes[i] === 'fieldsUsed') {
          selector[attributes[i]] = { '$in': this[attributes[i]] };
        } else if (!this[attributes[i]][0].includes("*")) {
          selector[attributes[i]] = this[attributes[i]][0] ;
        } else {
          selector[attributes[i]] = { '$regex': this[attributes[i]][0], '$options': 'i' };
        }
        
      }
    }
    
    // account for the bag-of-words refinements
    const refinement = Refinements.find({ruleNumber: this.patternNumber}).fetch()[0];
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
    }

    console.log(selector);

    selector['label'] = '?';
    return fetchShortestExamples(selector).count();
  },

  updateMessage: function(obj) {
    if (obj.explanation != undefined && obj.label == 'positive') {
      return "<-- From the suppression of the above warning, the patterns on the left may be updated";
    }
    return "";
  },
  updateMessageClasses: function(obj) {

    if (Session.get('isBaseline')) {
      return "hidden";
    }
    if (obj.explanation != undefined && obj.label == 'positive') {
      return "alert alert-info";
    }
    return "hidden";
  },

  exampleColoring: function(obj) {
      if (obj.label == 'negative') {
        return 'rgba(0,180,0, 0.6)';
      } else if (obj.label == 'positive') {
        return 'rgba(180,0,0, 0.6)';
      }

      return 'rgba(0,100,225, 0.6)'
    // }
  },

  debugNodes: function(obj) {
    return JSON.stringify(Object.keys(obj));
  },
  csv : function(debug, subgraphIds) {
    // console.log('csv',debug, subgraphIds);
    if (subgraphIds == undefined) return '';
    return subgraphIds.join(',');
  },



  hideIfBaseline: function(node) {
    if (Session.get('isBaseline')) {
      return 'hidden';
    }
  },
  hideIfNotBaseline: function(node) {
    if (!Session.get('isBaseline')) {
      return 'hidden';
    }
  },
  hideIfLabelByExample: function(node) {
    if (Session.get('isLabelByExample')) {
      return 'display:none;';
    }
  },
  hideIfNotLabelByExample: function(node) {
    if (!Session.get('isLabelByExample')) {
      return 'display:none;';
    }
  },

  shrinkIfLabelByExample: function(node) {
    if (Session.get('isLabelByExample')) {
      return 'col-md-5';
    } else {
      return '';
    }
  },
  expandIfLabelByExample: function(node) {
    if (Session.get('isLabelByExample')) {
      return 'col-md-11';
    } else {
      return 'col-md-5';
    }
  },


  hideIfNotTrace: function(node) {
    if (!Session.get('traceEnabled')) {
      return 'hidden';
    }
    return !node.records || node.records?.length == 0 ? 'hidden' : '';
  },

 



  hideIfEmptyDescription: function(text) {
    if (!text) {
      return 'hidden';
    }
  },



  hideIfBlank: function(text) {
    if (!text || text == '') {
      return 'hidden';
    }
  },

  joinDash : function(subgraphIds) {
    if (subgraphIds == undefined) return '';
    return subgraphIds.join('-');
  },

  
  showIfContains : function(subgraphIds, subgraphId) {
    return subgraphIds.indexOf(subgraphId) != -1 ? 'visible' : 'invisible';
  },
  boundedBoxIfFocalAPI: function(node) {
    // console.log(node);
    if (node.text == Session.get('focalAPI')) {
      return 'boundedBox';
    }
    return '';
  },


  codeFormPrefix: function(role) {
    if (role == 'method') {
      return ' ';
    } 
    if (role == 'guard') {
      return '<span class="hljs-keyword"> if </span> (...';
    }
    if (role =='parameter1') {
      return '';
    }
  },
  codeFormSuffix: function(role) {
    if (role == 'method') {
      return ' ';
    } 
    if (role == 'guard') {
      return '...) {';
    }
    if (role =='parameter1') {
      return '';
    }

  },
  
  displayNode: function(text) {
    var result = escapeNodeForDisplay(text);

    return result;
  },

  roundOff: function(num) {
    if (num == undefined) return '';
    return num.toFixed(2);
  },
 
  displayQualifier: function(qualifier) {
    return qualifier.replace('$$', '<span class="keyword-highlight">').replace('/$', '</span>').replace('@@', '<span class="line-highlight">').replace('/@', '</span>');
  },
  githubUrlWithLineNumber: function(obj) {
    var url = obj.url;
    var lineNumber = obj.line_number;
    return url + '#L' + lineNumber;
  },
  countExamples: function(examples) {
    return examples.length;
  },



  

  
  
};

/*
 * Register the global helper functions for all templates
 */
_.each(helpers, function(value, key){
  Template.registerHelper(key, value);
});


function getTopPatternIds() {


  // find max pattern number
  var maxPatternNumber = -1;


  // also check Containment
  var containments = Containment.find({}).fetch();
  containments.forEach(function (containment) {
    if (containment.patternNumber > maxPatternNumber) {
      maxPatternNumber = containment.patternNumber;
    }
  });




  var patternIds = [];
  for (var i = 0; i <= maxPatternNumber; i++) {
    patternIds.push({
      patternId: i,
    });
  }


  var previousObservedCounts = Session.get('numPatternsCounted');
  if (patternIds.length != previousObservedCounts) {
    Session.set('viewPatternIndicator', true);
  }

  return patternIds;
}


function escapeNodeForDisplay(text) {
  if (text == undefined) return '';
  var result = text.replaceAll('__', '.')
    // .replaceAll("UNKNOWN", "<expr>");
    .replaceAll("UNKNOWN.", "");
  if (result.includes("String:")) {
    result = '' + result.replaceAll("String:", '"') + '"';
  }
  if (result.includes("int:")) {
    result = '' + result.replaceAll("int:", '') + '';
  }

  if (result.includes("<catch>")) {
    result = "catch (...) ";
  }
  if (result.includes("<r>")) {
    result = "if (...) ";
  }
  if (result.includes('<throw>')) {
    result = 'throw ';
  }
  if (result.includes("<init>")) {
    result = '<span class="hljs-keyword">' +  "new " + '</span>' + result.replaceAll(".<init>", "(...)");
  }
  if (result.includes("<cast>")) {
    result = "(" + result.replaceAll(".<cast>", ") ...");
  }
  if (result.includes("<return>")) {
    result = "return ";
  }
  if (result.includes("<break>")) {
    result = "break ";
  }
  if (result.includes("<continue>")) {
    result = "continue ";
  }
  if (result.includes('<nullcheck>')) {
    result = ' == null';
  }
  if (result.includes("<instanceof>")) {
    result = '... <span class="hljs-keyword">instanceof </span>' + result.replaceAll(".<instanceof>", "") + '';
  }
  return result;
}








