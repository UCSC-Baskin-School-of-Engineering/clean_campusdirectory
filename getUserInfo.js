
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const XLSX = require('xlsx');

/*
  Fetch users that are affiliated with the departments listed in `deps`

  Author: wades
*/

const deps = {
  'soe-ams': {
    name: 'Applied Math & Statistics Department',
  },
  'soe-ce': {
    name: 'Computer Engineering Department',
  },
  'soe-tm': {
    name: 'Technology Management',
  },
};


const getUsers = async (page) => {
  const users = {};

  for (const depId in deps) {
    const dep = deps[depId];
    console.log('Fetching user ids for:', dep.name);

    await page.goto(`https://campusdirectory.ucsc.edu/cd_department?ou=${depId}`);

    const affils = await page.$$eval('table#dresults tbody tr', (els) => {
      return els.map((el) => {
        const c = el.children;
        const userId = c[2].querySelector('a').textContent.trim();;
        const name = c[0].textContent.trim();
        const aff = c[5].textContent.trim();

        return [userId, aff, name];
      });
    });

    for (const [userId, aff, name] of affils) {
      const user = users[userId];
      if (user) {
        user.deps[depId] = true;
      } else users[userId] = { aff, name, deps: { [depId]: true } };
    }
  }

  return users;
};

const otherUsers = {
  brummell: "Applied Mathematics Department",
  // cyrus: "Computer Engineering",
  elm: "Computer Science and Engineering Department",
  gmoulds: "Computer Science and Engineering Department",
  mantey: "Electrical and Computer Engineering Department",
  // mendes: "Applied Mathematics & Statistics",
  rcurry: "Electrical and Computer Engineering Department",
};

const depMap = {
  CSE: 'Computer Science and Engineering Department',
  ECE: 'Electrical and Computer Engineering Department',
  STAT: 'Statistics Department',
  AM: 'Applied Mathematics Department',
};
const validDeps = {};
for (const id in depMap) validDeps[depMap[id]] = true;

const readRows = (filename) => {
  const workbook = XLSX.readFile(filename);
  return XLSX.utils.sheet_to_row_object_array(workbook.Sheets[workbook.SheetNames[0]]);
};

(async () => {

  // const browser = await puppeteer.launch({
  //   executablePath: '/usr/bin/chromium-browser',
  // });

  // const page = await browser.newPage();

  // const users = await getUsers(page);

  const users = await fs.readJSON('./users.json');

  const nameMap = {};
  for (const userId in users) {
    const user = users[userId];
    if (user.aff === 'Undergraduate') delete users[userId];
    else nameMap[user.name] = user;
  }


  for (const row of readRows('grads.xlsx')) {
    const userId = row.Email.substring(0, row.Email.length - 9);
    const user = users[userId];
    if (user) {
      const newDep = depMap[row.Department];
      if (newDep) user.newDep = newDep;
    }
  }

  for (const row of readRows('senateFaculty.xls')) {
    const name = `${row.First} ${row.Last}`;
    const user = nameMap[name];
    if (user) {
      if (row.NewDep in depMap) user.newDep = depMap[row.NewDep];
    }
  }

  for (const row of readRows('nonSenateFaculty.xls')) {
    const name = `${row.First} ${row.Last}`;
    const user = nameMap[name];
    if (user) {
      if (row.NewDep in validDeps) user.newDep = row.NewDep;
    }
  }

  for (const userId in otherUsers) {
    users[userId].newDep = otherUsers[userId];
  }

  for (const userId in users) {
    const user = users[userId];
    if (!user.newDep) console.log(userId + ', ' + user.name + ', ' + user.aff);
  }

  // console.log(users);

  // await fs.outputJSON('./users.json', users);

  // await browser.close();
  process.exit(0);
})()
.catch((err) => {
  console.error(err);
  process.exit(1);
});
