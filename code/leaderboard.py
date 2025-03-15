import os

score_sheet_path = 'code/meteor_app'

original_labels_file = 'labels_orig.txt'
all_labels = []
with open(os.path.join(score_sheet_path, original_labels_file), 'r') as f:
    all_labels = f.read().splitlines()

true_labels = {}
for label in all_labels:
    label = label.split()
    true_labels[label[0]] = label[1]

# Read all the files with pattern '_x__labels.txt' where x is an integer
# and store them in a dictionary
all_files = {}
for file in os.listdir(score_sheet_path):
    if file.endswith('_labels.txt'):
        # get x in '_x__labels.txt'
        x = file.split('_')[1]
        with open(os.path.join
                    (score_sheet_path, file), 'r') as f:
            all_files[x] = f.read().splitlines()

print(all_files)

# file in all files is actually a participant id. I want to compare their labels with the true labels and keep score
scores = {}
for file in all_files:
    score = 0
    for label in all_files[file]:
        label = label.split()
        if true_labels[label[0]] == label[1]:
            score += 1
    scores[file] = score

print(scores)