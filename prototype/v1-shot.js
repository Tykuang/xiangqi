// Open tests.html in headless Chrome and capture test results
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///D:/AI%20WORKSPACE/XiangQi/tests.html';
const OUT = 'D:\\AI WORKSPACE\\XiangQi\\prototype\\screenshots\\tests-result.png';

const cmd = [
  `"${CHROME}"`,
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=900x1400',
  `--screenshot="${OUT}"`,
  `--virtual-time-budget=5000`,
  `"${URL}"`,
].join(' ');

console.log('Running tests...');
execSync(cmd, { stdio: 'inherit', timeout: 30000 });
console.log('Tests screenshot saved to:', OUT);

// Also render the main game (index.html)
const URL2 = 'file:///D:/AI%20WORKSPACE/XiangQi/index.html';
const OUT2 = 'D:\\AI WORKSPACE\\XiangQi\\prototype\\screenshots\\v1-main-board.png';
const cmd2 = [
  `"${CHROME}"`,
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=1440x900',
  `--screenshot="${OUT2}"`,
  `--virtual-time-budget=5000`,
  `"${URL2}"`,
].join(' ');
console.log('Rendering main board...');
execSync(cmd2, { stdio: 'inherit', timeout: 30000 });
console.log('Main board saved to:', OUT2);
