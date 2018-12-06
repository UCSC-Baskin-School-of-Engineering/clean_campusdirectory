
const puppeteer = require('puppeteer');
const { loginCruzid, getElValue, clickNav } = require('./utils');
const fs = require('fs-extra');

/*
  Update directory info for the users in the file: `users.json`

  Author: wades
*/


const mapping = {
  'Applied Math & Statistics Department': null,
  'Computer Engineering Department': null,
  'Technology Management': null,
};
// map=null => delete department
// map='some-dep' => change department to 'some-dep'



let users;

(async () => {

  users = await fs.readJSON('./users.json');

  const browser = await puppeteer.launch({
    // headless: false,
    // slowMo: 100,
    executablePath: '/usr/bin/chromium-browser',
  });

  const page = await browser.newPage();

  console.log('Logging in...');
  await loginCruzid(page);
  console.log('Finished login');


  for (const userId in users) {
    const userInfo = users[userId];

    if (userInfo.aff === 'Undergraduate' || userInfo.done || userInfo.error || userInfo.num > 0) continue;

    console.log('\nUser:', userId);

    await page.goto(`https://cruzid.ucsc.edu/idmuser_profile?cruzid=${userId}`);

    const officeLoc = await getElValue(page, '#ucscpersonpublocationcaan');
    const officeNum = await getElValue(page, '[name="data[ucscpersonpubofficelocationdetail][]"]');
    // const additionalLoc = await getElValue(page, '[name="data[ucscPersonPubRoomNumber][]"]');
    console.log('OfficeLoc:', officeLoc);
    console.log('OfficeNum:', officeNum);

    if (officeLoc === null) await page.$eval('#ucscpersonpublocationcaan', el => { el.value = '7194'; });
    if (officeNum === null) await page.$eval('[name="data[ucscpersonpubofficelocationdetail][]"]', el => { el.value = 'N/A'; });

    const { num, msgs } = await page.$$eval('[name="data[ucscPersonPubDepartmentNumber][]"]', (els, _mapping, _newDep) => {
      const msgs = [];
      let num = els.length;
      for (const el of els) {
        const oldDep = el.value;
        const newDep = _mapping[oldDep];
        if (newDep === null) {
          msgs.push('Delete: ' + oldDep);
          num--;
          el.value = '';
        } else if (newDep) {
          msgs.push('Change: ' + oldDep + ' -> ' + newDep);
          el.value = newDep;
        }
      }
      if (num === 0 && _newDep) {
        msgs.push('Add: ' + _newDep);
        els[0].value = _newDep;
        num++;
      }
      return { num, msgs };
    }, mapping, userInfo.newDep);
    console.log(msgs.join('\n'));

    userInfo.num = num;
    if (num <= 0) {
      console.log('Invalid: no deps remaining');
      userInfo.error = true;
      continue;
    }

    await page.click('input[type="submit"]');
    await page.waitFor(2000);
    if (await page.$('.messages.error')) {
      userInfo.error = true;
    } else {
      userInfo.done = true;
    }
  }

  await fs.outputJSON('./users.json', users);

  await browser.close();
  process.exit(0);
})()
.catch((err) => {
  fs.outputJSONSync('./users.error.json', users);

  console.error(err);
  process.exit(1);
});

process.on('SIGINT', () => {
  fs.outputJSONSync('./users.cancel.json', users);
  process.exit(1);
});
