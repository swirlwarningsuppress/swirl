import '../imports/ui/body.js';
// import '../imports/ui/option.js';

// var APIshortName = 'digest';
// var API = 'java.security.MessageDigest__digest';
// var APIfocalNode = 'MessageDigest.getInstance()';

var warningShortName = "crypto";
var warningType = "crypto";

var warningShortName = "socket";
var warningType = "socket";

var warningShortName = "infer";
var warningType = "infer";

// var APIshortName = "random";
// var API = "java.security.SecureRandom__Key";
// var APIfocalNode = "SecureRandom.<init>";


var traceEnabled = true;

Meteor.startup(function(){
    $.getScript('js/tutorons-library.js', function(){
        console.log('script should be loaded and do something with it.');
        spanAdder = new tutorons.TutoronsConnection(window);
        spanAdder.scanDom();
    });


    Session.set('countTooLowThreshold',0);
    Session.set('numOptions',3);
    Session.set('toggleZeroCount', true);
    Session.set('hideLabels', false);
    Session.set('hideOptions', false);
   $('.collapse').collapse('show');
    //  $('.collapse').show();  
  
    // var subjectNum = Number(prompt("Please enter your participant ID", "0"));
    
    Session.set('subjectNum',-1); //update for each subject
    Session.set('dataset', warningShortName)
    
    // Session.set('focalAPI', 'Cipher__init()');
    // Session.set('focalAPI', API.split('.')[2] + '()');
    

    Session.set('view', 'all');
    //create object which maps user id to correct dataset?

    // var participantId = Number(prompt("Please enter your participant ID", "0"));
    
    // var datasets = {1: 'fileInputStream', 2: 'findViewById', 3: 'get', 4: 'query'};
    Session.set('subjectNum', -1); //update for each subject

    // Session.set('dataset', datasets[datasetID]); //update for each subject
    Session.set('selector',{});


    Session.set('informativenessWeight', 0.5 );
    Session.set('representativenessWeight', 0.5 );
    Session.set('diversityWeight', 0.5 );

    Session.set('matchSink', true);
    Session.set('isLabelByExample', true);
    Session.set('inspectedPattern', 0);
    

    console.log('session',Session.keys);

    const paramsArray = window.location.search.slice(1).split('&');

    // Create an object to store the parameters
    const params = {};
  
    // Loop through the key-value pairs and populate the params object
    for (const param of paramsArray) {
      const [key, value] = param.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
    var isBaseline = params[ 'baseline' ] == 'true';
    if (isBaseline) {
        Session.set('isBaseline', true);
    } else {
        Session.set('isBaseline', false);
    }

    var participantID = params[ 'participantID' ];
    Session.set('subjectNum', participantID);
    $('#participant_id').val(participantID).trigger('change');

    // if ( ) {
        Session.set('traceEnabled', traceEnabled);
    // }

    if (params[ 'dataset' ]) {
        Session.set('dataset', params[ 'dataset' ]); //'findViewById'); //update for each subject
    
    }
    $('.show-unmatching-spare-button').click();
    if (!isBaseline) {
        // $('.open-label-query-examples-modal').click();
        // $('.show-unmatching-spare-button').click();
    } else {
        // $('.show-unmatching-spare-button').click();
        // $('.open-label-query-examples-modal').click();
    }
      
        
});
