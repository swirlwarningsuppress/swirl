# this script modifies NULL_DEREFERENCE__nacos_graph_id_mapping.txt.
# it checks for the size of the graph, determined from the nubmer of nodes in NULL_DEREFERENCE__nacos_vertmap.txt
# then it retains the 25 smallest graphs and removes the rest

# instructions: python3 meteor_app/misc_scripts/keep_only_subset_of_warnings.py NULL_DEREFERENCE__nacos 25
# cp meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_graph_id_mapping.txt.new  meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_graph_id_mapping.txt

import os
import sys
import re
import shutil
import time
import subprocess
import numpy as np
import json
import random

random.seed(1)
np.random.seed(1)

# read in the graph id mapping file
def read_graph_id_mapping(graph_id_mapping_file):
    graph_id_mapping = {}
    graph_id_to_example_id = {}
    with open(graph_id_mapping_file, 'r') as f:
        for line in f:
            line = line.strip()
            example_id = line.split(',')[2].split(' - ')[0]
            graph_id = line.split(',')[1]
            
            graph_id_mapping[graph_id] = line
            graph_id_to_example_id[graph_id] = example_id

    return graph_id_mapping, graph_id_to_example_id

# read in the nacos element_positions_file file
def read_graphs(element_positions_file):
    # read json
    with open(element_positions_file, 'r') as f:
        data = f.read()
    
        data = json.loads(data)
    print(data.keys())
    return data
    
    
   
# due to the hack to get around the source/sink issue (we currently show only the sink, although the data has the source)
def ignore_odd_numbered_graphs(graph_id_mapping, graph_id_to_example_id):
    new_graph_id_mapping = {}
    for graph_id, line in graph_id_mapping.items():
        example_id = graph_id_to_example_id[graph_id]
        if int(example_id) % 2 == 0:
            new_graph_id_mapping[graph_id] = line

    return new_graph_id_mapping


def random_graph_ids(graph_id_mapping, graph_data, num_to_retain):

    graph_ids = list(graph_id_mapping.keys())
    np.random.shuffle(graph_ids)
    graph_ids_to_retain = graph_ids[:num_to_retain]
    print('randomly choose ', len(graph_ids_to_retain), ' graphs')

    return graph_ids_to_retain
    



# write out the new graph id mapping file

def write_new_graph_id_mapping(graph_id_mapping, warningType):
    new_graph_id_mapping_file = 'meteor_app/private/original_graphs/' + warningType + '_graph_id_mapping.txt.new'
    with open(new_graph_id_mapping_file, 'w') as f:
        for graph_id, line in graph_id_mapping.items():
            f.write(line + '\n')

# main function

def main(warningType, size):
    graph_id_mapping_file = 'meteor_app/private/original_graphs/' + warningType + '_graph_id_mapping.txt'
    element_positions_file = 'meteor_app/private/original_graphs/' + warningType + '_elementpositions.json'

    graph_id_mapping, graph_id_to_example_id = read_graph_id_mapping(graph_id_mapping_file)
    print(graph_id_to_example_id)
    graph_data = read_graphs(element_positions_file)
    
    graph_id_to_keep = random_graph_ids(ignore_odd_numbered_graphs(graph_id_mapping, graph_id_to_example_id), graph_data, size)

    # remove the largest graphs
    all_graphs = list(graph_id_mapping.keys())
    for graph_id in all_graphs:
        if graph_id not in graph_id_to_keep:
            del graph_id_mapping[graph_id]

    write_new_graph_id_mapping(graph_id_mapping,  warningType)

    print('done')


if __name__ == '__main__':
    warningType = sys.argv[1]
    size = int(sys.argv[2])
    main(warningType, size)
    




