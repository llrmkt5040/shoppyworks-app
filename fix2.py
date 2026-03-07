code = open('/Users/yusukeok5040/shoppyworks-app/src/pages/ActionLogPage.jsx').read()
print('行数:', len(code.splitlines()))
print('Field関数あり:', 'function Field' in code)
