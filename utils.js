require('dotenv').config();
const { URL } = require('url');


/*
 * Utilities for programmatically navigating Drupal SOE sites
 * e.g. login, create a page, etc.
 * 
 * Author: wades
 */

// const objOfObjectsToArray = (obj) => {
//   const arr = [];
//   for (const key in obj) {
//     arr.push({
//       ...obj[key],
//       __key: key,
//     });
//   }
//   return arr;
// };

exports.getElValue = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return undefined;
  else return el.value ? el.value : null;
}, selector);

exports.clickNav = (page, selector, timeout = 10000) => Promise.all([
  page.waitForNavigation({ timeout }),
  page.click(selector),
])
.catch((err) => {
  console.log('Failed to click navigate from:', page.url());
  throw err;
});

exports.loginCruzid = async (page) => {
  await page.goto('https://cruzid.ucsc.edu');

  await page.type('#idmuser-login #txtCruzId', process.env.SOE_USER);
  await page.type('#idmuser-login #txtPassword', process.env.SOE_GOLD_PASS);

  await exports.clickNav(page, '#idmuser-login #edit-submit');

  if (page.url().endsWith('/idmuser_login')) throw { message: 'bad username or password' };
};

exports.login7 = async (page, site) => {
  await page.goto(`https://${site}/user/login`);

  await page.type('#user-login-form #edit-name', process.env.SOE_USER7);
  await page.type('#user-login-form #edit-pass', process.env.SOE_PASS7);

  await exports.clickNav(page, '#user-login-form #edit-submit', 20000);
  
  if (page.url().endsWith('/user/login')) throw { message: 'bad username or password' };
};

exports.login8 = async (page, site) => {
  await page.goto(`https://${site}/user/login`);

  await page.type('#user-login-form #edit-name', process.env.SOE_USER8);
  await page.type('#user-login-form #edit-pass', process.env.SOE_PASS8);

  await exports.clickNav(page, '#user-login-form #edit-submit', 20000);
  
  if (page.url().endsWith('/user/login')) throw { message: 'bad username or password' };
};

exports.batchPage = async (browser, datas, fn, amount = 8) => { // max listeners is 10 for EE
  let pages = [];
  for (let i = 0; i < amount && i < datas.length; i++) pages.push(browser.newPage());
  pages = await Promise.all(pages);
  let results = [];
  
  for (let i = 0; i < datas.length;) {
    const res = [];
    for (let j = 0; j < amount && i < datas.length; j++, i++) {
      res.push(fn(pages[j], datas[i]).catch((err) => {
        console.log(datas[i], err);
      }));
    }
    results = results.concat(await Promise.all(res));
  }
  return results;
};


const types = {
  title: 'page-title',
  slider: 'large-slider',
};

const S = (selector) => `[data-drupal-selector="${selector}"]`;

exports.newPage = async (page, site, { title, body, content }) => {

  await page.goto(`https://${site}/node/add/page`);

  await page.type('#edit-title-0-value', title);
  
  for (let i = 0; i < content.length; i++) {
    const { columns, type, value } = content[i];

    let typeName;
    if (columns) typeName = `${columns.length}-column`;
    else typeName = types[type];

    await page.click(S(`edit-field-content-add-more-add-more-button-${typeName}${columns && columns.length !== 1 ? 's' : ''}`));

    const selector = S(`edit-field-content-${i}`);
    await page.waitForSelector(selector, { timeout: 3001 });  
    
    // body TODO
    
    if (type === 'title') {
      await page.type(selector + ' input[type="text"]', value);      
    } else if (type === 'slider') {
      // TODO
    } else if (columns) {
      for (let j = 0; j < columns.length; j++) {
        const { file, html, title: columnTitle } = columns[j];

        await page.click(S(`edit-field-content-${i}-subform-field-${typeName}-content-section-add-more-add-more-button-content-section`));        

        const section = S(`edit-field-content-${i}-subform-field-${typeName}-content-section-${j}`);

        await page.waitForSelector(section + ' a.cke_button__source', { timeout: 3003 });
        
        await page.waitFor(1000);

        if (html) {

          await page.click(section + ' a.cke_button__source');
      
          await page.waitForSelector(section + ' textarea.cke_source', { timeout: 3004 });
      
          await page.$eval(section + ' textarea.cke_source', (el, _html) => {
            el.value = _html;
          }, html);
        }

        if (file) {
          const $file = await page.$(section + ' input[type="file"]');
          await $file.uploadFile(file.path);
  
          await page.waitForSelector(S(`edit-field-content-${i}-subform-field-${typeName}-content-section-${j}-subform-field-sc-image-0-alt`));
          
          await page.type(S(`edit-field-content-${i}-subform-field-${typeName}-content-section-${j}-subform-field-sc-image-0-alt`), file.alt || 'temp');   
          
          await page.type(S(`edit-field-content-${i}-subform-field-${typeName}-content-section-${j}-subform-field-sc-image-0-title`), file.title || 'temp');
        }

        if (columnTitle) {
          await page.type(S(`edit-field-content-${i}-subform-field-${typeName}-content-section-${j}-subform-field-sc-title-0-value`), columnTitle);             
        }
      }
    } else {
      throw { message: 'Invalid type: ' + type };
    }
  }

  await exports.clickNav(page, '#edit-submit');

  return new URL(page.url()).pathname;
};
