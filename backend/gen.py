import os, sys
code = open("server.txt").read()
open("server.js", "w").write(code)
print("Done")
