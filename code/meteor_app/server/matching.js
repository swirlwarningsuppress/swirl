

var regexMiner = function(positiveText, negativeText, nextFunction) {

  // java -Xmx32G -jar /Users/xxx/repos/suppression_interface/Surf/code/meteor_app/misc_scripts/resnax_runner.jar /Users/xxx/Downloads/ips/ips/lib
  spawn = Npm.require('child_process').spawn;
  // console.log('spawining child process for mining regex', positiveText, negativeText);

  var positiveTextWithSuffix = positiveText.map(function(item) { return item + ',+'; });
  var negativeTextWithSuffix = negativeText.map(function(item) { return item + ',+'; });

  console.log(' spawning ', 'java', ['-Xmx32G', '-jar', appPath + "misc_scripts/resnax_runner.jar" ,
  appPath + 'misc_scripts/lib/', ...positiveTextWithSuffix, ...negativeTextWithSuffix].join(' '));
  
  var command = spawn('java',['-Xmx32G', '-jar', appPath + "misc_scripts/resnax_runner.jar" ,
  appPath + 'misc_scripts/lib/', ...positiveTextWithSuffix, ...negativeTextWithSuffix]);

  command.stdout.on('data',  function (data) {
    console.log('[regexMiner] stdout: ' + data);
  });

  command.stderr.on('data', function (data) {
      console.log('[regexMiner] stderr: ' + data);
  });

  command.on('exit', Meteor.bindEnvironment(function (code) {
    console.log('child process exited with code ' + code);

    // read resnax-answers

    var resnax_answers = fs.readFileSync(appPath + 'misc_scripts/resnax-answers', 'utf8');
    var lines = resnax_answers.split('\n');
    nextFunction(lines);
  }));

}

var regexMinerSubtypes = function() {
  var positiveExamploes = [];
  var negativeExamploes = [];
  var examples = Examples.find({ label : {'$in' : ['positive', 'negative']} }).fetch();
  if (examples.length == 0) {
    return;
  }
  examples.forEach(function(example){
    if (example.label === 'positive') {
      positiveExamploes.push(example.ancestry + '.' + example.classname);
    } else {
      negativeExamploes.push(example.ancestry+ '.' + example.classname);
    }
  });

  regexMiner(positiveExamploes, negativeExamploes, function(lines) {
    lines.then( subtypes => _.each(subtypes,
      function (subtype) {
        
        if (subtype.includes(' ')) {
          return;
        }
        console.log('inserting subtype ' + subtype);
        
        Containment.insert({type: subtype});
      }
      ));
    });
}

export function mineSubtypes(Examples) {

  // just mine frequent patterns
  // no graphs involved here
  // find the most frequent subtypes among positive or negative examples
  var counts = {};
  var examples = Examples.find({ label : {'$in' : ['positive', 'negative']} }).fetch();
//   console.log(examples)
  var totalPositive = 0;
  examples.forEach(function(example){
    if (example.label === 'positive') {
      example.ancestry.forEach(function(ancestor){
        if (!counts[ancestor]) {
          counts[ancestor] = 0;
        }
        counts[ancestor] += 1;
      });

      totalPositive += 1;
    } else {
      example.ancestry.forEach(function(ancestor){
        counts[ancestor] = -1000;
      });
    }
  });

  console.log(counts);
  // return the  subtypes common to all positive cases
  var commonSubtypes = [];
  Object.keys(counts).forEach(function(subtype){
    // if (counts[subtype] == totalPositive || counts[subtype] > 1) {
      commonSubtypes.push(subtype);
    // }
  });

  console.log('[mineSubtypes] commonSubtypes', commonSubtypes);
  // promisify commonSubtypes
  return new Promise((resolve, reject) => {
    resolve(commonSubtypes); 
  });
  // return commonSubtypes;
}

var inferCommonSubtypes = function(exampleIds) {
  var openai = new OpenAIApi(new Configuration({ apiKey: openaiApiKey }));

  var positiveExamploes = [];
  var negativeExamploes = [];

  if (exampleIds.length == 0) {
    return;
  }
  var examples =  Examples.find({ exampleID : {'$in' : exampleIds} }).fetch();
  examples.forEach(function(example){
    if (example.label === 'positive') {
      positiveExamploes.push(example.ancestry );
    } else {
      negativeExamploes.push(example.ancestry);
    }
  });

  console.log('[inferCommonSubtypes] positiveExamploes');
  console.log(positiveExamploes);
  console.log('[inferCommonSubtypes] negativeExamploes');
  console.log(negativeExamploes);

  return openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    // prompt: "Given the following examples, provide a regular expression without lookaheads that matches these positive examples:\n\n" + positiveExamploes.join('\n') + "\n\nbut not these negative examples:" + negativeExamploes.join('\n') + "\nAnswer with just the regular expression.\n",
    // prompt: "hello",
    messages: [ {'role': 'user', 'content': "Given the following examples, provide 3 possible regular expressions, separated by newlines without numbering the lines, without lookaheads that matches all of these positive examples:\n\n" + positiveExamploes.join('\n') + "\n\nbut not any of the negative examples:" + negativeExamploes.join('\n') + "\nAnswer with just the regular expressions (without numbering your output).\n"}],
  }).then((response) => {
    // console.log('returning ');
    // console.log(response.data );
    // console.log(response.data.choices[0].message.content );
    // console.log(`request cost: ${response.data.usage.total_tokens} tokens`);
    
    // Return the text of the response
    var subtypes =  response.data.choices[0].message.content.split('\n').filter(function(item) { return item.length > 0; }
    );

    // check that each subtype regex matches all the positive examples and none of the negative examples
    return subtypes.filter(function(subtype) {

      // check that the subtype matches all the positive examples
      var matchesAllPositive = positiveExamploes.every(function(positiveExample) {
        // check regular expression
        try {
          var regex = new RegExp(subtype);
          return regex.test(positiveExample);
        } catch (e) {
          return false;
        }
      });
      var matchesNoneNegative = negativeExamploes.every(function(negativeExample) {
        // check regular expression
        try {
          var regex = new RegExp(subtype);
          return !regex.test(negativeExample);
        } catch (e) {
          return false;
        }
      }
      );
      return matchesAllPositive && matchesNoneNegative;
    });
  }).catch((err) => {
    console.log(err);
  });

}

var regexMinerPackages = function() {
  var positiveExamploes = [];
  var negativeExamploes = [];
  var examples = Examples.find({ label : {'$in' : ['positive', 'negative']} }).fetch();
  if (examples.length == 0) {
    return;
  }
  examples.forEach(function(example){
    if (example.label === 'positive') {
      positiveExamploes.push(example.ancestry + '.' + example.classname);
    } else {
      negativeExamploes.push(example.ancestry+ '.' + example.classname);
    }
  });

  regexMiner(positiveExamploes, negativeExamploes, function(lines) {
    lines.then( pkgs => _.each(pkgs,
      function (pkg) {

        // if there's a space in the pkg, gpt must have done something more
        // so we ignore it
        if (pkg.includes(' ')) {
          return;
        }

        console.log('inserting pkg ' + pkg);
        Containment.insert({pkg: pkg});
      }
      ));
    });
}

export function minePackages(Examples) {
  // TODO: this function should shell out to some kind of regular expression miner

  // just mine frequent patterns
  // no graphs involved here
  // find the most frequent packages among positive or negative examples
  var counts = {};
  var positiveExamploes = [];
    var negativeExamploes = [];

  var examples = Examples.find({ label : {'$in' : ['positive', 'negative']} }).fetch();
  examples.forEach(function(example){
    if (example.label === 'positive') {
      positiveExamploes.push(example.pkg);
    } else {
      negativeExamploes.push(example.pkg);
    }
  });

  console.log('[minePkg] positiveExamploes');
  console.log(positiveExamploes);
  console.log('[minePkg] negativeExamploes');
  console.log(negativeExamploes);

  var counts = {};
  var totalPositive = 0;
//   positiveExamploes.forEach(function(pkg){
    
//       if (!counts[pkg]) {
//         counts[pkg] = 0;
//       }
//       counts[pkg] += 1;
//       totalPositive +=1; 
//   });
//   negativeExamploes.forEach(function(pkg){
//       counts[pkg] = -1000;
//   });

  extractTemplates(positiveExamploes).forEach(function(pkgs){
    pkgs.forEach(function(pkg){
    console.log('pkg', pkg)
    // strip whitespace in pkg
    pkg = pkg.replace(/\s/g, '');

    if (!counts[pkg]) {
        counts[pkg] = 0;
        }
        counts[pkg] += 1;
        totalPositive +=1;
    });
  });
    
  console.log('counts');
  console.log(counts)
  // return the  packages common to all positive cases
  var commonPackages = [];
  Object.keys(counts).forEach(function(pkg){
    // if (counts[pkg] == totalPositive) {
      commonPackages.push(pkg);
    // }
  });
    console.log('[minePackages] common packages', commonPackages);
  // return commonPackages;

  return new Promise((resolve, reject) => {
    resolve(commonPackages); 
  });
}

var inferPackages = function(exampleIds) {
  var openai = new OpenAIApi(new Configuration({ apiKey: openaiApiKey }));

  var positiveExamploes = [];
  var negativeExamploes = [];
  if (exampleIds.length == 0) {
    return;
  }
  if (exampleIds.length == 0) {
    return;
  }
  var examples =  Examples.find({ exampleID : {'$in' : exampleIds} }).fetch();
  examples.forEach(function(example){
    if (example.label === 'positive') {
      positiveExamploes.push(example.pkg);
    } else {
      negativeExamploes.push(example.pkg);
    }
  });

  console.log('[pkg] positiveExamploes');
  console.log(positiveExamploes);
  console.log('[pkg] negativeExamploes');
  console.log(negativeExamploes);

  return openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    // prompt: "Given the following examples, provide a regular expression without lookaheads that matches these positive examples:\n\n" + positiveExamploes.join('\n') + "\n\nbut not these negative examples:" + negativeExamploes.join('\n') + "\nAnswer with just the regular expression.\n",
    // prompt: "hello",
    messages: [ {'role': 'user', 'content': "Given the following examples, provide 3 possible regular expressions, separated by newlines without numbering the lines, without lookaheads that matches these positive examples:\n\n" + positiveExamploes.join('\n') + "\n\nbut not these negative examples:" + negativeExamploes.join('\n') + "\nAnswer with just the regular expressions (without numbering your output).\n"}],
  }).then((response) => {
    console.log('returning ');
    console.log(response.data );
    console.log(response.data.choices[0].message.content );
    // console.log(`request cost: ${response.data.usage.total_tokens} tokens`);
    
    // Return the text of the response
    // return response.data.choices[0].message.content;
    var pkgs =  response.data.choices[0].message.content.split('\n').filter(function(item) { return item.length > 0; }
    );

    // check that each pkg regex matches all the positive examples and none of the negative examples
    return pkgs.filter(function(pkg) {

      // check that the pkg matches all the positive examples
      var matchesAllPositive = positiveExamploes.every(function(positiveExample) {
        // check regular expression
        try {
          var regex = new RegExp(pkg);
          return regex.test(positiveExample);
        } catch (e) {
          return false;
        }
      });
      var matchesNoneNegative = negativeExamploes.every(function(negativeExample) {
        // check regular expression
        try{
          var regex = new RegExp(pkg);
          return !regex.test(negativeExample);
        } catch (e) {
          return false;
        }
      }
      );
      return matchesAllPositive && matchesNoneNegative;
    });
  }).catch((err) => {
    console.log(err);
  });

}

export function mineNames(Examples) {
    var positiveExamploes = [];
    var negativeExamploes = [];

    var examples = Examples.find({ label : {'$in' : ['positive', 'negative']} }).fetch();
    examples.forEach(function(example){
      if (example.label === 'positive') {
        positiveExamploes.push(example.classname);
      } else {
        negativeExamploes.push(example.classname);
      }
    });
  
    console.log('[mineNames] positiveExamploes');
    console.log(positiveExamploes);
    console.log('[mineNames] negativeExamploes');
    console.log(negativeExamploes);

    var counts = {};
    var totalPositive = 0;
    positiveExamploes.forEach(function(classname){
      
        if (!counts[classname]) {
          counts[classname] = 0;
        }
        counts[classname] += 1;
        totalPositive +=1; 
 
          
        
      
    });
    negativeExamploes.forEach(function(classname){
        counts[classname] = -1000;
    });

     // return the  names common to all positive cases
    var commonNames = [];
    Object.keys(counts).forEach(function(classname){
        // if (counts[classname] == totalPositive) {
        commonNames.push(classname);
        // }
    });
        console.log('[mineNames] common names', commonNames);
    // return commonNames;

    return new Promise((resolve, reject) => {
        resolve(commonNames);
    });

}


var inferName = function(exampleIds) {
  var openai = new OpenAIApi(new Configuration({ apiKey: openaiApiKey }));

  var positiveExamploes = [];
  var negativeExamploes = [];

  if (exampleIds.length == 0) {
    return;
  }
  var examples =  Examples.find({ exampleID : {'$in' : exampleIds} }).fetch();
  examples.forEach(function(example){
    if (example.label === 'positive') {
      positiveExamploes.push(example.classname);
    } else {
      negativeExamploes.push(example.classname);
    }
  });

  console.log('[inferName] positiveExamploes');
  console.log(positiveExamploes);
  console.log('[inferName] negativeExamploes');
  console.log(negativeExamploes);

  return openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    // prompt: "Given the following examples, provide a regular expression without lookaheads that matches these positive examples:\n\n" + positiveExamploes.join('\n') + "\n\nbut not these negative examples:" + negativeExamploes.join('\n') + "\nAnswer with just the regular expression.\n",
    // prompt: "hello",
    messages: [ {'role': 'user', 'content': "Given the following examples, provide 3 possible regular expressions, separated by newlines without numbering the lines, without lookaheads that matches these positive examples:\n\n" + positiveExamploes.join('\n') + "\n\nbut not these negative examples:" + negativeExamploes.join('\n') + "\nAnswer with just the regular expressions (without numbering your output).\n"}],
  }).then((response) => {
    console.log('returning ');
    console.log(response.data );
    console.log(response.data.choices[0].message.content );
    // console.log(`request cost: ${response.data.usage.total_tokens} tokens`);
    
    // Return the text of the response
    // return response.data.choices[0].message.content;
    var pkgs =  response.data.choices[0].message.content.split('\n').filter(function(item) { return item.length > 0; }
    );

    // check that each pkg regex matches all the positive examples and none of the negative examples
    return pkgs.filter(function(pkg) {

      // check that the pkg matches all the positive examples
      var matchesAllPositive = positiveExamploes.every(function(positiveExample) {
        // check regular expression
        try{
          var regex = new RegExp(pkg);
          return regex.test(positiveExample);
        } catch (e) {
          return false;
        }
      });
      var matchesNoneNegative = negativeExamploes.every(function(negativeExample) {
        // check regular expression
        try{
          var regex = new RegExp(pkg);
          return !regex.test(negativeExample);
        } catch (e) {
          return false;
        }
      }
      );
      return matchesAllPositive && matchesNoneNegative;
    });
  }).catch((err) => {
    console.log(err);
  });

}

export function mineReturnTypes(Examples) {
    var positiveExamploes = [];
    var negativeExamploes = [];

    var examples = Examples.find({ label : {'$in' : ['positive', 'negative']} }).fetch();
    examples.forEach(function(example){
      if (example.label === 'positive') {
        positiveExamploes.push(example.retType);
      } else {
        negativeExamploes.push(example.retType);
      }
    });
  
    console.log('[mineNames] positiveExamploes');
    console.log(positiveExamploes);
    console.log('[mineNames] negativeExamploes');
    console.log(negativeExamploes);

    var counts = {};
    var totalPositive = 0;
    positiveExamploes.forEach(function(retType){
      
        if (!counts[retType]) {
          counts[retType] = 0;
        }
        counts[retType] += 1;
        totalPositive +=1; 
 
          
        
      
    });
    negativeExamploes.forEach(function(retType){
        counts[retType] = -1000;
    });

     // return the  names common to all positive cases
    var commonNames = [];
    Object.keys(counts).forEach(function(retType){
        // if (counts[retType] == totalPositive || counts[retType] > 1) {
        commonNames.push(retType);
        // }
    });
        console.log('[mineRetType] common retType', commonNames);
    // return commonNames;

    return new Promise((resolve, reject) => {
        resolve(commonNames);
    });

}

export function mineFieldsUsed(Examples) {
    var positiveExamploes = [];
    var negativeExamploes = [];

    var examples = Examples.find({ label : {'$in' : ['positive', 'negative']} }).fetch();
    examples.forEach(function(example){
      if (example.label === 'positive') {
        positiveExamploes.push(example.fieldsUsed);
      } else {
        negativeExamploes.push(example.fieldsUsed);
      }
    });
  
    console.log('[mineNames] positiveExamploes');
    console.log(positiveExamploes);
    console.log('[mineNames] negativeExamploes');
    console.log(negativeExamploes);

    var counts = {};
    var totalPositive = 0;
    positiveExamploes.forEach(function(fieldsUsed){
      
        if (!counts[fieldsUsed]) {
          counts[fieldsUsed] = 0;
        }
        counts[fieldsUsed] += 1;
        totalPositive +=1; 
 
          
        
      
    });
    negativeExamploes.forEach(function(fieldsUsed){
        counts[fieldsUsed] = -1000;
    });

     // return the  names common to all positive cases
    var commonNames = [];
    Object.keys(counts).forEach(function(fieldsUsed){
        // if (counts[fieldsUsed] == totalPositive || counts[fieldsUsed] > 1) {
        commonNames.push(fieldsUsed);
        // }
    });
        console.log('[mineFieldsUsed] common fieldsUsed', commonNames);
    // return commonNames;

    return new Promise((resolve, reject) => {
        resolve(commonNames);
    });

}


function calculateSimilarity(str1, str2) {
    let words1 = new Set(str1);
    let words2 = new Set(str2);
    let commonWords = new Set([...words1].filter(word => words2.has(word)));
    return commonWords.size;
}

function clusterStrings(strings, threshold ) {
    let clusters = [];
     

    strings.forEach(str => {
        let added = false;
        for (let cluster of clusters) {
            let similarity = calculateSimilarity(str, cluster[0]);
            if (similarity >= threshold) {
                cluster.push(str);
                added = true;
                break;
            }
        }
        if (!added) {
            clusters.push([str]);
        }
    });

    return clusters;
}

function findTemplate(strings) {
    let template = strings[0].map((_, i) => strings.every(s => s[i] === strings[0][i]) ? strings[0][i] : '\\w+');
    return template.join(' ');
}

export function extractTemplates(strings) {
    let splitStrings = strings.map(s => s.split(/(?=[A-Z])|\b/));

    var allTemplates = [];

    for (let i = 2; i <= 5; i++) {
        let clusters = clusterStrings(splitStrings, i);

        var templates = clusters.map(cluster => findTemplate(cluster));

        allTemplates.push(templates);
    }

    return allTemplates;
}


export function generateWildcardPatterns(str) {
  // console.log('[generateWildcardPatterns] str', str)
  let parts = str.split('.');
  let patterns = [];
  let pattern = '';

  for (let part of parts) {
      let subParts = part.split(/(?=[A-Z0-9])/);

      for (let subPart of subParts) {
          pattern += subPart;
          patterns.push(pattern + '__dotstar__');
      }

      pattern += '.';
  }

  patterns = patterns.filter((value, index, self) => self.indexOf(value) === index).slice(0, -1);
  // console.log('[generateWildcardPatterns] patterns', patterns);
  return patterns;
}

export function generateWildcardPatternsForPrefix(str) {
  // console.log('[generateWildcardPatternsForPrefix] str', str)
  const parts = str.split(".");
  
  let patterns = [];
  
  for (var partI = 0; partI < parts.length; partI++) {
    // console.log('[generateWildcardPatternsForPrefix] partI', partI, parts[partI])
      var part = parts[partI];
      var partSuffix = parts.slice(partI + 1).join('.');
      var partPrefix = partI > 0 ? parts.slice(0, partI).join('.') + "." : "";

      let subParts = part.split(/(?=[A-Z0-9])/);
    
      for (var subpartI = 1; subpartI < subParts.length + 1; subpartI++) {
        var suffix = subParts.slice(subpartI).join('');

        // console.log('[generateWildcardPatternsForPrefix] adding', partPrefix, '.* ', suffix, partSuffix);

        patterns.push(partPrefix + '__dotstar__' + suffix + '.' + partSuffix);
      }

      
  }

  // console.log('[generateWildcardPatternsForPrefix] patterns', patterns);
  return patterns;
}
