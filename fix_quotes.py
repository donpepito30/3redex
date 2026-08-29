import sys

with open("index.html", "r") as f:
    content = f.read()

content = content.replace("querySelector('.relative.aspect-\\[4\\/5\\]')", "querySelector('.relative.aspect-\\\\[4\\\\/5\\\\]')")

with open("index.html", "w") as f:
    f.write(content)
print("Done")
