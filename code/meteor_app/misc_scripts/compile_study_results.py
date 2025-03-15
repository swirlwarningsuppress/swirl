import glob
from collections import defaultdict

matching_files = glob.glob("*/code/meteor_app/*/*_labels.txt")

results_even = defaultdict(list)
results_odd = defaultdict(list)
for file_path in matching_files:
    person = file_path.split('/')[-2]
    odd_or_even = int(file_path.split('/')[0].split('Surf')[1]) % 2 == 0
    with open(file_path, 'r') as file:
        labels = []
        lines = file.readlines()
        for line in lines:
            labels.append(line.strip())
    if odd_or_even:
        results_even[person] = labels
    else:
        results_odd[person] = labels

for one_result in [results_odd, results_even]:
    # compare against ground-truth
    ground_truth = one_result['ground-truth']
    for person in one_result:
        if person == 'ground-truth':
            continue
        labels = one_result[person]
        # compare set difference
        print(person)
        # print('set difference: ', set(ground_truth) - set(labels))
        # compare intersection
        print('intersection: ', len(set(ground_truth) & set(labels)))
    print('========')

        

