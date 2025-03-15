# the idea is to try different combinations 
# IMPORTANT: prequisites for running this script : run `meteor` in the `meteor_app` directory 
# Run one of 
# e.g., WARNING_TYPE=apache_lucene-solr__NULL_ WARNING_JSON_NAME=spotbugs_warnings_apache_lucene-solr__NULL_ meteor  
# e.g., WARNING_JSON_NAME=infer_warnings_alibaba_nacos_NULL_DEREFERENCE meteor 
# e.g,, WARNING_TYPE=RESOURCE_LEAK__presto WARNING_JSON_NAME=infer_warnings_prestodb_presto_RESOURCE_LEAK meteor 
# and generate the background.lp file 

import random
import subprocess
import sys
import os
from collections import defaultdict
import json
import time
import matplotlib.pyplot as plt

def read_ground_truth(ground_truth_file):
    ground_truth = {}
    with open(ground_truth_file) as f:
        for line in f:
            line = line.strip().split()
            ground_truth[line[0]] = line[1]
    return ground_truth

def write_labels_to_clingo_input(poss, negs):
    with open('lp/simulation_labels.lp', 'w+') as f:
        for p in poss:
            f.write(f'pos({p}).\n')
        for n in negs:
            f.write(f'neg({n}).\n')

def read_containment(containment_file='lp/background.lp'):
    containment = {}
    last_checked_id = -1  # Initialize last_checked_id to keep track of the last ID we processed

    with open(containment_file) as f:
        for line in f:
            line = line.strip().split()

            # If line contains 'containment', extract the warning ID
            if 'containment' in line[0]:
                id = int(line[0].split('containment(')[1].split(',')[0])

                # Only process the first occurrence of each ID
                if id != last_checked_id:
                    loc = line[1].split(")")[0]
                    loc = loc.replace('__', '.').replace('_', '.')
                    last_checked_id = id  # Update last_checked_id to prevent re-checking this ID
                    containment[id] = loc  # Store the location for this ID
    return containment

def heuristic_shorter_code_first(warnings):
    """Sort the warnings by lines of code (ascending)."""
    return sorted(warnings, key=lambda x: x[1])

def heuristic_shared_function_calls(warnings):
    """Sort the warnings by the number of shared function calls (descending)."""
    def shared_function_calls(warning, other_warnings):
        return sum(len(set(warning[2]).intersection(set(other[2]))) for other in other_warnings)
    #print(sorted(warnings, key=lambda x: shared_function_calls(x, warnings), reverse=True))
    return sorted(warnings, key=lambda x: shared_function_calls(x, warnings), reverse=True)

def heuristic_neighbor_classes(warnings, containment):
    """Sort the warnings by neighbor classes (contained in the same package or directory)."""
    sorted_warnings = []
    processed_locs = set()
    
    for i in range(len(warnings)):
        loc = containment.get(int(warnings[i][0]))
        if loc not in processed_locs:
            # Find all warnings with the same location
            same_loc_warnings = [warnings[j] for j in range(i, len(warnings)) if containment.get(int(warnings[j][0])) == loc]
            sorted_warnings.extend(same_loc_warnings)
            processed_locs.add(loc)
    #print(sorted_warnings)
    return sorted_warnings

def initialize_warnings_state(ground_truth):
    """Initialize all warnings with the state 'uninspected'."""
    return {k: 'uninspected' for k in ground_truth.keys()}

def calculate_accuracy(warnings_state, ground_truth):
    """Calculate the accuracy by comparing the current state of warnings with the ground truth."""
    print('Warnings State:', warnings_state)
    print('Ground Truth:', ground_truth)

    correct_labels = sum(1 for k, v in warnings_state.items() if v == ground_truth[k])
    print('Correct Labels:', correct_labels)
    return correct_labels / len(ground_truth) * 100

def get_number_of_uninspected_warnings_of_rule(rule_number, model):
    # rule_predict_pos<number>(<warning>)
    uninspected_warnings = []
    for line in model:
        matches_rule = line.startswith(f'rule_predict_pos{rule_number}') if rule_number != 0 else line.startswith('rule_predict_pos(')
        if matches_rule:
            # extract warning from parenthesis
            warning = line.split('(')[1].split(')')[0]
            if warning not in ground_truth:
                continue
            if warnings_state[warning] == 'uninspected':
                uninspected_warnings.append(warning)
    return len(uninspected_warnings)

def get_number_of_most_uninspected_warnings_of_rule(rules, model):
    max_uninspected = 0
    rule_number = 0
    for rule in rules:
        num_uninspected = get_number_of_uninspected_warnings_of_rule(rule, model)
        if num_uninspected > max_uninspected:
            max_uninspected = num_uninspected
            rule_number = rule
    return rule_number, max_uninspected


def sample_labels_randomized_then_sorted(ground_truth, num_pos, num_neg, code_data, warnings_state, apply_heuristics=None, sampling_ratio=0.5, warning_ids=None, use_ground_truth=False):
    """
    Apply specified heuristics to the warnings before sampling:
    - apply_heuristics: A list containing the numbers [1, 2, 3] corresponding to the heuristics to apply.
        1: Review the shorter code first.
        2: Look for similar code (shared API calls).
        3: Look for neighbor classes (contained in the same package or directory).
    - If warning_ids is provided, apply the heuristics to only those warnings.
    - If use_ground_truth is True, classify warnings based on ground_truth instead of code length.
    - After applying heuristics, select either one positive or one negative warning based on a coin toss.
    """
    if apply_heuristics is None:
        apply_heuristics = [1, 2, 3]  # Default to applying all heuristics

    # Determine which warnings to operate on: either from ground_truth or passed warning_ids
    if warning_ids:
        warnings = [
            (k, code_data.get(int(k), {}).get('linesOfCode', 0), code_data.get(int(k), {}).get('functionCalls', []), 'uninspected')
            for k in warning_ids if warnings_state.get(k) == 'uninspected'
        ]
    else:
        # Get all uninspected warnings with their lines of code and function calls
        warnings = [
            (k, code_data.get(int(k), {}).get('linesOfCode', 0), code_data.get(int(k), {}).get('functionCalls', []), 'uninspected')
            for k, v in ground_truth.items() if warnings_state[k] == 'uninspected'
        ]

    #random.shuffle(warnings)

    if len(warnings) > 1:
        warnings = warnings[:int(len(warnings) * sampling_ratio)]
    
    if not warnings:  # If all warnings have been inspected or none passed, return empty lists
        return [], []
    
    # Apply heuristics in the specified order
    containment = read_containment()
    for heuristic in apply_heuristics:
        if heuristic == 1:
            warnings = heuristic_shorter_code_first(warnings)
        elif heuristic == 2:
            warnings = heuristic_shared_function_calls(warnings)
        elif heuristic == 3:
            warnings = heuristic_neighbor_classes(warnings, containment)
        elif heuristic == 4:
            # choose a random heuristic
            warnings = random.choice([heuristic_shorter_code_first(warnings), 
                                      heuristic_shared_function_calls(warnings), 
                                      heuristic_neighbor_classes(warnings, containment)])

    if use_ground_truth:
        # Use ground truth labels instead of sorting by code length
        selected_positive_warnings = []
        selected_negative_warnings = []

        selected_warning = warnings[0][0]
        print('Selected Warning:', warnings[0])
        if ground_truth[selected_warning] == 'positive':
            warnings_state[selected_warning] = 'positive'
            selected_positive_warnings.append(selected_warning)

        if ground_truth[selected_warning] == 'negative':
            warnings_state[selected_warning] = 'negative'
            selected_negative_warnings.append(selected_warning)
        print('Selected positive warning:', selected_positive_warnings)
        print('Selected negative warning:', selected_negative_warnings)
        return selected_positive_warnings, selected_negative_warnings

    else:
        # Sort by code length to identify shortest and longest warnings
        sorted_warnings_by_length = sorted(warnings, key=lambda x: x[1])

        # Classify warnings as positive or negative based on their position in the sorted list
        for i in range(len(warnings)):
            if warnings[i] in sorted_warnings_by_length[:len(sorted_warnings_by_length)//2]:
                warnings[i] = list(warnings[i])
                warnings[i][3] = 'positive'
                warnings[i] = tuple(warnings[i])
            else:
                warnings[i] = list(warnings[i])
                warnings[i][3] = 'negative'
                warnings[i] = tuple(warnings[i])    
    
    # Coin toss to decide whether to pick a positive or negative warning
    #coin_toss = random.choice(['positive', 'negative'])
    coin_toss = 'positive'

    if coin_toss == 'positive':
        # Select the shortest warning for positive
        selected_positive_warnings = [warnings[0][0]]
        selected_negative_warnings = []
        warnings_state[selected_positive_warnings[0]] = 'positive'
    else:
        # Select the longest warning for negative
        selected_positive_warnings = []
        selected_negative_warnings = [warnings[-1][0]]
        warnings_state[selected_negative_warnings[0]] = 'negative'
    
    print('Selected positive warning:', selected_positive_warnings)
    print('Selected negative warning:', selected_negative_warnings)
    
    return selected_positive_warnings, selected_negative_warnings




def run_clingo():
    files = [
        f'lp/simulation_labels.lp',  
        'lp/background.lp',              
        'lp/frozen_rules.lp',            
        'lp/rules2.lp'                   
    ]
    
    command = ['clingo'] + files + ['--outf=2'] + ['--time-limit=30'] 
    print(' '.join(command))
    result = subprocess.run(command, capture_output=True, text=True)

    return result.stdout

def parse_clingo_output(data):
    # Load the data using json.loads if 'data' is a string,
    # otherwise assume it's already a dictionary
    if isinstance(data, str):
        #print(data)
        data = json.loads(data.replace("'", '"'))
    # Navigate through the JSON structure
    # Assuming 'Call' is always present and has at least one element
    calls = data.get("Call", [])
    if calls:
        # Assuming 'Witnesses' is always present in the last element of 'Call' and has at least one element
        last_call = calls[-1]
        witnesses = last_call.get("Witnesses", [])
        if witnesses:
            # Get the last 'Witnesses' entry
            last_witness = witnesses[-1]
            # Return the 'Value' list from the last 'Witnesses' entry
            return last_witness.get("Value", [])
    return []

def extract_summary_rules(clingo_output):
    # a summary rule is one prefixed by rule_contains(number)
    summary_rules_by_prefix = defaultdict(list)
    for line in clingo_output:
        if line.startswith('rule_contains'):

            number_str = line.split('(')[0].split('rule_contains')[1]
            number = int(number_str) if number_str.isdigit() else 0

            rule = line.split('(')[1].split(')')[0]
            summary_rules_by_prefix[number].append(rule)
    return summary_rules_by_prefix

def calculate_rule_percentage(clingo_output, positive_predictions):
    summary_rules_by_prefix = defaultdict(list)
    rule_percentages = {}
    for line in clingo_output:
        if line.startswith('rule_predict_pos'):
            number_str = line.split('(')[0].split('rule_predict_pos')[1]
            if number_str == '':
                number_str = '0'
            number = int(number_str)
            warning_number = line.split('(')[1].split(')')[0]
            summary_rules_by_prefix[number].append(warning_number)
    for rule_number, matched_warnings in summary_rules_by_prefix.items():
        rule_percentages[rule_number] = len(set(matched_warnings) & set(positive_predictions)) / len(set(matched_warnings))
    return rule_percentages

def number_of_rules_over_percentage(percentages, percentage_threshold=0.8):
    return sum(1 for p in percentages.values() if p >= percentage_threshold)

def get_number_of_positive_predictions(clingo_output):
    positive_predictions = set()
    for line in clingo_output:
        if line.startswith('rule_predict_pos'):
            warning_number = line.split('(')[1].split(')')[0]
            positive_predictions.add(warning_number)
    return len(positive_predictions)


def get_positive_predictions(clingo_output, rule_numbers):
    # rule_predict_pos<number>(<warning>)
    positive_predictions = []
    for line in clingo_output:
        if line.startswith('rule_predict_pos'):
            number_str = line.split('(')[0].split('rule_predict_pos')[1]
            number = int(number_str) if number_str.isdigit() else 0
            if number not in rule_numbers:
                continue
            # extract warning from parenthesis
            warning = line.split('(')[1].split(')')[0]
            if warning not in ground_truth:
                continue
            positive_predictions.append(warning)
    return positive_predictions

def get_positive_predictions_of_rule(clingo_output, rule_number):
    # rule_predict_pos<number>(<warning>)
    positive_predictions = []
    # here print('rule_predict_pos' + str(rule_number))
    for line in clingo_output:
        matches_rule = line.startswith(f'rule_predict_pos{rule_number}') if rule_number != 0 else line.startswith('rule_predict_pos(')
        if matches_rule:
            # extract warning from parenthesis
            warning = line.split('(')[1].split(')')[0]
            if warning not in ground_truth:
                continue
            positive_predictions.append(warning)
    return positive_predictions    

# Simulation driver code

# Parameters for the simulation
warning_type = sys.argv[1]
ground_truth_file = sys.argv[2]

# Read ground_truth data
ground_truth = read_ground_truth(ground_truth_file)

graph_id_to_warning = {}
with open('meteor_app/private/original_graphs/' + warning_type + '_graph_id_mapping.txt', 'r') as file:
    for line in file:
        graph_id = line.split(',')[1]
        example_id = line.split(',')[2].split(' - ')[0]
        graph_id_to_warning[graph_id] = example_id

# Load code data from JSON
with open('meteor_app/private/original_graphs/' + warning_type + '_elementpositions.json', 'r') as file:
    code_content_data = json.load(file)

code_data = {}

for graph_id_str, another_json_str in code_content_data.items():
    warning_data = json.loads(another_json_str)

    # Code length
    raw_code = warning_data.get("rawCode", "")
    raw_code_length = len(raw_code.splitlines())
    try:
        warning_id = int(graph_id_to_warning[graph_id_str])
    except:
        continue

    code_data[warning_id] = {}

    code_data[warning_id]['linesOfCode'] = raw_code_length

    # Find all code expressions that look like function calls
    function_calls = [expression for expression in warning_data['expressionStart'].keys() if '()' in expression and '->' not in expression]

    code_data[warning_id]['functionCalls'] = function_calls

# Scenarios: 1 = Heuristic 1, 2 = Heuristic 2, 3 = Heuristic 3, 4 = All Heuristics
scenarios = {
    'Heuristic 1 Only': [1],
    'Heuristic 2 Only': [2],
    'Heuristic 3 Only': [3],
    'All Heuristics': [4]
}


for iter in range(1, 21):
    # Store the accuracy, rule percentage, and conciseness results for each scenario
    accuracy_results = {key: {'p=0': [], 'p=0.5': [], 'p=1': []} for key in scenarios.keys()}
    rule_percentage_results = {key: {'p=0': [], 'p=0.5': [], 'p=1': []} for key in scenarios.keys()}
    conciseness_results = {key: {'p=0': [], 'p=0.5': [], 'p=1': []} for key in scenarios.keys()}

    # Run simulations for each scenario
    for scenario_name, heuristics in scenarios.items():
        rule_percentage = 0
        conciseness = 0
        accuracy = 0
        #for p_value in [1, 0.5, 0]:
        for p_value in [0.5]:
            print(f"Running scenario: {scenario_name} with p={p_value}")

            warnings_state = initialize_warnings_state(ground_truth)
            num_warnings = len(ground_truth)


            # get the first warning
            selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, initialize_warnings_state(ground_truth), apply_heuristics=heuristics, use_ground_truth=True)
            if selected_pos:
                warnings_state[selected_pos[0]] = 'positive'
            if selected_neg:
                warnings_state[selected_neg[0]] = 'negative'
            
            pos_labels = [k for k, v in warnings_state.items() if v == 'positive']
            neg_labels = [k for k, v in warnings_state.items() if v == 'negative']

            write_labels_to_clingo_input(pos_labels, neg_labels)
            output = run_clingo()
        
            # Run simulation for # of warnings iterations
            for iteration in range(num_warnings - 1):
                if all([v != 'uninspected' for v in warnings_state.values()]):
                    # fill in the rest of the warnings with the last accuracy, rule percentage, and conciseness
                    for i in range(iteration, num_warnings):
                        accuracy_results[scenario_name][f'p={p_value}'].append(accuracy)
                        rule_percentage_results[scenario_name][f'p={p_value}'].append(rule_percentage)
                        conciseness_results[scenario_name][f'p={p_value}'].append(conciseness)
                    break
                
                print(f'Simulation Iteration {iteration} for {scenario_name} with p={p_value}')

                if p_value == 1:
                    print('Using rules to select positive/negative warnings')
                    # Use the rules to select positive/negative warnings
                    if output:
                        model = parse_clingo_output(output)
                        rule_numbers = list(extract_summary_rules(model).keys())
                        if rule_numbers:
                            rule_number_to_check, max_uninspected = get_number_of_most_uninspected_warnings_of_rule(rule_numbers, model)
                            # here print('Rule number to check:', rule_number_to_check)
                            # here print('Max uninspected warnings:', max_uninspected)
                            # here print('Rule numbers:', rule_numbers)
                            # here print('Model:', model)
                            if max_uninspected > 0:
                                selected_all_pos = get_positive_predictions_of_rule(model, rule_number_to_check)
                                selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, warnings_state, apply_heuristics=heuristics, warning_ids=selected_all_pos, use_ground_truth=True)
                                
                                # 0.05 probability to mark all matching warnings as positive/negative
                                if random.random() <= 0.05 and iteration > num_warnings // 2:
                                    for pos in selected_all_pos:
                                        warnings_state[pos] = 'positive'
                            else:
                                selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, warnings_state, apply_heuristics=heuristics, use_ground_truth=True)
                        else:
                            selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, warnings_state, apply_heuristics=heuristics, use_ground_truth=True)



                elif p_value == 0.5:
                    # 50% chance to use the rules or the original heuristic-based sampling
                    if random.random() < 0.5:
                        if output:
                            model = parse_clingo_output(output)
                            rule_numbers = list(extract_summary_rules(model).keys())
                            if rule_numbers:
                                rule_number_to_check, max_uninspected = get_number_of_most_uninspected_warnings_of_rule(rule_numbers, model)
                                # here print('Rule number to check:', rule_number_to_check)
                                # here print('Max uninspected warnings:', max_uninspected)
                                # here print('Rule numbers:', rule_numbers)
                                # here print('Model:', model)
                                if max_uninspected > 0:
                                    selected_all_pos = get_positive_predictions_of_rule(model, rule_number_to_check)
                                    selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, warnings_state, apply_heuristics=heuristics, warning_ids=selected_all_pos, use_ground_truth=True)
                                    
                                    # 0.05 probability to mark all matching warnings as positive/negative
                                    if random.random() <= 0.05 and iteration > num_warnings // 2:
                                        for pos in selected_all_pos:
                                            warnings_state[pos] = 'positive'
                                else:
                                    selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, warnings_state, apply_heuristics=heuristics, use_ground_truth=True)

                    else:
                        selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, warnings_state, apply_heuristics=heuristics, use_ground_truth=True)

                elif p_value == 0:
                    # p=0, just use the original heuristic-based sampling
                    selected_pos, selected_neg = sample_labels_randomized_then_sorted(ground_truth, 1, 1, code_data, warnings_state, apply_heuristics=heuristics, use_ground_truth=True)
                print('Number of Rules: ', len(rule_numbers))
                # Write labels to Clingo input and run Clingo
                pos_labels = [k for k, v in warnings_state.items() if v == 'positive']
                neg_labels = [k for k, v in warnings_state.items() if v == 'negative']

                write_labels_to_clingo_input(pos_labels, neg_labels)
                output = run_clingo()
                #print('Output:', output)

                if output:
                    model = parse_clingo_output(output)
                    inferred_rules = extract_summary_rules(model)
                    percentages = calculate_rule_percentage(model, pos_labels)
                    num_rules_over_threshold = number_of_rules_over_percentage(percentages)
                    num_rules = len(inferred_rules)
                    number_of_positive_predictions = get_number_of_positive_predictions(model)

                    if num_rules_over_threshold > 0:
                        conciseness = number_of_positive_predictions / num_rules_over_threshold
                    else:
                        conciseness = 0

                    # Calculate the percentage of rules over the threshold
                    if num_rules > 0:
                        rule_percentage = (num_rules_over_threshold / num_rules) * 100
                    else:
                        rule_percentage = 0

                    rule_percentage_results[scenario_name][f'p={p_value}'].append(rule_percentage)
                    conciseness_results[scenario_name][f'p={p_value}'].append(conciseness)

                # Calculate accuracy after each iteration
                accuracy = calculate_accuracy(warnings_state, ground_truth)
                accuracy_results[scenario_name][f'p={p_value}'].append(accuracy)
                print(f'Accuracy after iteration {iteration}: {accuracy:.2f}%')
                print(f'Percentage of rules over threshold after iteration {iteration}: {rule_percentage:.2f}%')
                print(f'Conciseness after iteration {iteration}: {conciseness:.2f}')

    # Save the results to a csv file
    if scenario_name == 'Heuristic 1 Only':
        scenario_name = 'h=1'
    elif scenario_name == 'Heuristic 2 Only':
        scenario_name = 'h=2'
    elif scenario_name == 'Heuristic 3 Only':
        scenario_name = 'h=3'
    elif scenario_name == 'All Heuristics':
        scenario_name = 'h=4'

    #scenario_name = ''

    if warning_type == 'apache_lucene-solr__NULL_':
        warning_type = 'apache_lucene_' + scenario_name
    elif warning_type == 'NULL_DEREFERENCE__nacos':
        warning_type = 'alibaba_nacos_' + scenario_name
    elif warning_type == 'RESOURCE_LEAK__presto':
        warning_type = 'presto_' + scenario_name
    elif warning_type == 'dubbo_external':
        warning_type = 'apache_dubbo_' + scenario_name

    with open(warning_type + '_' + str(iter) + '.csv', 'w') as f:
        f.write('Scenario,Probability,Iteration,Accuracy,Rule Percentage,Conciseness\n')
        for scenario_name, p_results in accuracy_results.items():
            for p_value, accuracy_list in p_results.items():
                rule_percentage_list = rule_percentage_results[scenario_name][p_value]
                conciseness_list = conciseness_results[scenario_name][p_value]
                for i in range(len(accuracy_list)):
                    if i < len(rule_percentage_list) and i < len(conciseness_list):
                        f.write(f'{scenario_name},{p_value},{i},{accuracy_list[i]},{rule_percentage_list[i]},{conciseness_list[i]}\n')
                    else:
                        f.write(f'{scenario_name},{p_value},{i},{accuracy_list[i]},0,0\n')