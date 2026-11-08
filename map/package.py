# Packages the built control into an importable unmanaged solution: out/EMPHProcessMap.zip.
# Run after the PCF build (see build.ps1).
import os, shutil, zipfile
here = os.path.dirname(os.path.abspath(__file__))
built = os.path.join(here, "pcf", "out", "controls", "ProcessMap")
ctl = os.path.join(here, "sol", "Controls", "emph_EMPH.ProcessMap")
for f in ("bundle.js", "ControlManifest.xml"):
    shutil.copyfile(os.path.join(built, f), os.path.join(ctl, f))
os.makedirs(os.path.join(here, "out"), exist_ok=True)
dest = os.path.join(here, "out", "EMPHProcessMap.zip")
sol = os.path.join(here, "sol")
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
    for dp, _, fn in os.walk(sol):
        for f in fn:
            p = os.path.join(dp, f)
            z.write(p, os.path.relpath(p, sol).replace(os.sep, "/"))
print("written", dest, os.path.getsize(dest), "bytes")
