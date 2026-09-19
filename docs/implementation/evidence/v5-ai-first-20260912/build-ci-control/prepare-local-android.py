"""Tune only generated ignored Android files; restore Expo's incidental package scripts."""
import json
import pathlib
import re
root=pathlib.Path.cwd()
before=(pathlib.Path(__file__).resolve().parent/'package-before-prebuild.json').read_bytes()
old=json.loads(before);current=json.loads((root/'package.json').read_bytes())
expected=json.loads(before);expected['scripts'].update(android='expo run:android',ios='expo run:ios')
assert current==expected,'Unexpected package change during prebuild; do not overwrite concurrent edits.'
(root/'package.json').write_bytes(before)
app=root/'android/app/build.gradle'
text=app.read_text()
needle='''            keyPassword 'android'
        }
    }
    buildTypes'''
replacement='''            keyPassword 'android'
        }
        existingPreview {
            storeFile file(System.getenv('USKOCI_ANDROID_STORE_FILE'))
            storePassword System.getenv('USKOCI_ANDROID_STORE_PASSWORD')
            keyAlias System.getenv('USKOCI_ANDROID_KEY_ALIAS')
            keyPassword System.getenv('USKOCI_ANDROID_KEY_PASSWORD')
        }
    }
    buildTypes'''
assert text.count(needle)==1
text=text.replace(needle,replacement)
needle='''            signingConfig signingConfigs.debug
            def enableShrinkResources'''
assert text.count(needle)==1
text=text.replace(needle,'''            signingConfig signingConfigs.existingPreview
            def enableShrinkResources''')
app.write_text(text,encoding='utf-8',newline='\n')
properties=root/'android/gradle.properties';text=properties.read_text()
for key,value in [('org.gradle.jvmargs','-Xmx4096m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8'),
                  ('reactNativeArchitectures','arm64-v8a,x86_64')]:
    text,n=re.subn(r'^'+re.escape(key)+r'=.*$',key+'='+value,text,flags=re.M);assert n==1
properties.write_text(text,encoding='utf-8',newline='\n')
print('Generated Android signing/ABI config ready; package scripts restored byte-for-byte.')
