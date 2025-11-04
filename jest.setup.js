require('@anthropic-ai/sdk/shims/node');
require('@testing-library/jest-dom');
const fs = require('fs');
const path = require('path');

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
  })
);
global.Request = jest.fn();
global.Response = jest.fn();

const envPath = path.join(__dirname, 'leakdetector_env.sh');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');

  envFile.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
}
