import os
import sys
from pathlib import Path
import shutil


cwd = os.getcwd()
project_path = cwd.split('Surf')[0] + 'Surf/'

# copy private/original_graphs/java.security.MessageDigest__digest_formatted.txt to private/original_graphs/java.security.MessageDigest__digest_formatted_onlylabelled.txt
shutil.copy(project_path + "code/meteor_app/private/original_graphs/java.security.MessageDigest__digest_formatted.txt", project_path + "/code/graphs/java.security.MessageDigest__digest_formatted.txt")

# cp meteor_app/private/original_graphs/java.security.MessageDigest__digest_vertmap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/java.security.MessageDigest__digest_vertmap.txt", project_path + "/code/graphs/java.security.MessageDigest__digest_vertmap.txt")

# cp meteor_app/private/original_graphs/java.security.MessageDigest__digest_edgemap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/java.security.MessageDigest__digest_edgemap.txt", project_path + "/code/graphs/java.security.MessageDigest__digest_edgemap.txt")

# cp meteor_app/private/original_graphs/javax.crypto.Cipher__init_formatted.txt graphs/javax.crypto.Cipher__init_formatted.txt
shutil.copy(project_path + "code/meteor_app/private/original_graphs/javax.crypto.Cipher__init_formatted.txt", project_path + "/code/graphs/javax.crypto.Cipher__init_formatted.txt")
# cp meteor_app/private/original_graphs/javax.crypto.Cipher__init_vertmap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/javax.crypto.Cipher__init_vertmap.txt", project_path + "/code/graphs/javax.crypto.Cipher__init_vertmap.txt")
# cp meteor_app/private/original_graphs/javax.crypto.Cipher__init_edgemap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/javax.crypto.Cipher__init_edgemap.txt", project_path + "/code/graphs/javax.crypto.Cipher__init_edgemap.txt")



# cp meteor_app/private/original_graphs/java.security.SecureRandom__next_formatted.txt graphs/java.security.SecureRandom__next_formatted.txt
shutil.copy(project_path + "code/meteor_app/private/original_graphs/java.security.SecureRandom__next_formatted.txt", project_path + "/code/graphs/java.security.SecureRandom__next_formatted.txt")
# cp meteor_app/private/original_graphs/java.security.SecureRandom__next_vertmap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/java.security.SecureRandom__next_vertmap.txt", project_path + "/code/graphs/java.security.SecureRandom__next_vertmap.txt")
# cp meteor_app/private/original_graphs/java.security.SecureRandom__next_edgemap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/java.security.SecureRandom__next_edgemap.txt", project_path + "/code/graphs/java.security.SecureRandom__next_edgemap.txt")

# cp meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_formatted.txt graphs/NULL_DEREFERENCE__nacos_formatted.txt
shutil.copy(project_path + "code/meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_formatted.txt", project_path + "/code/graphs/NULL_DEREFERENCE__nacos_formatted.txt")
# cp meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_vertmap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_vertmap.txt", project_path + "/code/graphs/NULL_DEREFERENCE__nacos_vertmap.txt")
# cp meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_edgemap.txt graphs
shutil.copy(project_path + "code/meteor_app/private/original_graphs/NULL_DEREFERENCE__nacos_edgemap.txt", project_path + "/code/graphs/NULL_DEREFERENCE__nacos_edgemap.txt")
