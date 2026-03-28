const path = require('path');

const ENV_FILE_PATH = path.join(__dirname, '.env');
const isHostedRuntime = Boolean(process.env.VERCEL);

let envLoadState = {
  mode: isHostedRuntime ? 'hosted' : 'local',
  loaded: false,
  path: ENV_FILE_PATH
};

if (!isHostedRuntime) {
  const dotenv = require('dotenv');
  const result = dotenv.config({
    path: ENV_FILE_PATH,
    override: false
  });

  envLoadState = {
    mode: 'local',
    loaded: !result.error,
    path: ENV_FILE_PATH
  };
}

module.exports = envLoadState;
