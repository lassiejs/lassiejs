require('nodejs-require-enhancer');
var chai = require('chai');
require('org/test/common/MochaAutoconfigurator.js');
var webdriver = require('selenium-webdriver');
const By = webdriver.By;
const until = webdriver.until;
var expect = chai.expect;
var assert = chai.assert;
const util = require('util')

describe('@DefaultAction', function() {
  it('entrypoint must be triggered if entrypoint="true"', function() {
    let driver = _liveHtmlDomTools.driver;
    return new Promise((resolve, reject) => {
      driver.get(_liveHtmlDomTools.baseUrl)
      .then(function() {
        return driver.wait(until.elementLocated(By.id('root')));
      })
      .then(function(body) {
        return body.getText();
      })
      .then(function(bodyText) {
        expect(bodyText).to.equal("I'm an action which is the entrypoint");
        resolve();
      }).catch(function(err){
        console.log(err);
        reject();
      });
    });
  });
  it('action must be triggered if its route is used', function() {
    let driver = _liveHtmlDomTools.driver;
    return new Promise((resolve, reject) => {
      driver.get(_liveHtmlDomTools.baseUrl+"#entrypoint")
      .then(function() {
        return driver.wait(until.elementLocated(By.id('root')));
      })
      .then(function(body) {
        return body.getText();
      })
      .then(function(bodyText) {
        expect(bodyText).to.equal("I'm an action which is the entrypoint");
        resolve();
      }).catch(function(err){
        console.log(err);
        reject();
      });
    });
  });
});