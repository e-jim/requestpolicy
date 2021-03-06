/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

/* global Components */
const {interfaces: Ci, utils: Cu} = Components;

/* exported PolicyManager, RULES_CHANGED_TOPIC */
this.EXPORTED_SYMBOLS = ["PolicyManager", "RULES_CHANGED_TOPIC"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {C} = importModule("lib/utils/constants");
let {Logger} = importModule("lib/logger");
let {RequestResult} = importModule("lib/request-result");
let {Ruleset, RawRuleset} = importModule("lib/ruleset");
let {RulesetStorage} = importModule("lib/ruleset-storage");

//==============================================================================
// constants
//==============================================================================

const RULES_CHANGED_TOPIC = "rpcontinued-rules-changed";

//==============================================================================
// utilities
//==============================================================================

function dprint(msg) {
  Logger.info(Logger.TYPE_POLICY, msg);
}

function warn(msg) {
  Logger.warning(Logger.TYPE_POLICY, msg);
}

function notifyRulesChanged() {
  Services.obs.notifyObservers(null, RULES_CHANGED_TOPIC, null);
}

//==============================================================================
// PolicyManager
//==============================================================================

/**
 * Provides a simplified interface to handling multiple
 * rulesets, checking requests against multiple rulesets, etc.
 */
var PolicyManager = (function() {
  let self = {};

  let userRulesets = {};
  let subscriptionRulesets = {};

  self.getUserRulesets = function() {
    return userRulesets;
  };
  self.getSubscriptionRulesets = function() {
    return subscriptionRulesets;
  };

  //self._rulesets = null;

  self.getUserRuleCount = function() {
    let rawRuleset = userRulesets.user.rawRuleset;
    return rawRuleset.getAllowRuleCount() + rawRuleset.getDenyRuleCount();
  };

  self.loadUserRules = function() {
    let rawRuleset;
    // Read the user rules from a file.
    try {
      dprint("PolicyManager::loadUserRules loading user rules");
      rawRuleset = RulesetStorage.loadRawRulesetFromFile("user.json");
      self.userRulesetExistedOnStartup = true;
    } catch (e) {
      // TODO: log a message about missing user.json ruleset file.
      // There's no user ruleset. This is either because RP has just been
      // installed, the file has been deleted, or something is wrong. For now,
      // we'll assume this is a new install.
      self.userRulesetExistedOnStartup = false;
      rawRuleset = new RawRuleset();
    }
    userRulesets.user = {
      "rawRuleset": rawRuleset,
      "ruleset": rawRuleset.toRuleset("user")
    };
    userRulesets.user.ruleset.userRuleset = true;
    //userRulesets.user.ruleset.print();
    // Temporary rules. These are never stored.
    self.revokeTemporaryRules();

    notifyRulesChanged();
  };

  self.loadSubscriptionRules = function(subscriptionInfo) {
    let failures = {};

    // Read each subscription from a file.
    let rawRuleset;
    for (let listName in subscriptionInfo) {
      for (let subName in subscriptionInfo[listName]) {
        try {
          dprint("PolicyManager::loadSubscriptionRules: " +
                 listName + " / " + subName);
          rawRuleset = RulesetStorage
              .loadRawRulesetFromFile(subName + ".json", listName);
        } catch (e) {
          warn("Unable to load ruleset from file: " + e);
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        if (!subscriptionRulesets[listName]) {
          subscriptionRulesets[listName] = {};
        }
        let list = subscriptionRulesets[listName];
        list[subName] = {
          "rawRuleset": rawRuleset,
          "ruleset": rawRuleset.toRuleset(subName)
        };
        list[subName].ruleset.userRuleset = false;
        //list[subName].ruleset.print();
      }
    }

    notifyRulesChanged();

    return failures;
  };

  self.unloadSubscriptionRules = function(subscriptionInfo) {
    var failures = {};

    for (let listName in subscriptionInfo) {
      for (let subName in subscriptionInfo[listName]) {
        dprint("PolicyManager::unloadSubscriptionRules: " +
                 listName + " / " + subName);
        if (!subscriptionRulesets[listName] ||
            !subscriptionRulesets[listName][subName]) {
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        let list = subscriptionRulesets[listName];
        delete list[subName];
      }
    }

    notifyRulesChanged();

    return failures;
  };

  function assertRuleAction(ruleAction) {
    if (ruleAction !== C.RULE_ACTION_ALLOW &&
        ruleAction !== C.RULE_ACTION_DENY) {
      throw "Invalid rule type: " + ruleAction;
    }
  }

  self.ruleExists = function(ruleAction, ruleData) {
    assertRuleAction(ruleAction);
    for (let name in userRulesets) {
      if (userRulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
        return true;
      }
    }
    for (let listName in subscriptionRulesets) {
      let rulesets = subscriptionRulesets[listName];
      for (let name in rulesets) {
        if (rulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
          return true;
        }
      }
    }
    return false;
  };

  self.addRule = function(ruleAction, ruleData, noStore) {
    dprint("PolicyManager::addRule " + ruleAction + " " +
        Ruleset.rawRuleToCanonicalString(ruleData));
    //userRulesets.user.ruleset.print();

    assertRuleAction(ruleAction);
    // TODO: check rule format validity
    userRulesets.user.rawRuleset.addRule(ruleAction, ruleData,
          userRulesets.user.ruleset);

    // TODO: only save if we actually added a rule. This will require
    // modifying |RawRuleset.addRule()| to indicate whether a rule
    // was added.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
      RulesetStorage.saveRawRulesetToFile(
          userRulesets.user.rawRuleset, "user.json");
    }

    //userRulesets.user.ruleset.print();

    notifyRulesChanged();
  };

  self.addRules = function(aRuleAction, aRuleDataList, aNoStore=false) {
    for (let ruleData of aRuleDataList) {
      PolicyManager.addRule(aRuleAction, ruleData, true);
    }
    if (false === aNoStore) {
      PolicyManager.storeRules();
    }
  };

  self.storeRules = function() {
    RulesetStorage.saveRawRulesetToFile(
        userRulesets.user.rawRuleset, "user.json");
  };

  self.addTemporaryRule = function(ruleAction, ruleData) {
    dprint("PolicyManager::addTemporaryRule " + ruleAction + " " +
        Ruleset.rawRuleToCanonicalString(ruleData));
    //userRulesets.temp.ruleset.print();

    assertRuleAction(ruleAction);
    // TODO: check rule format validity
    userRulesets.temp.rawRuleset.addRule(ruleAction, ruleData,
          userRulesets.temp.ruleset);

    //userRulesets.temp.ruleset.print();

    notifyRulesChanged();
  };

  self.removeRule = function(ruleAction, ruleData, noStore) {
    dprint("PolicyManager::removeRule " + ruleAction + " " +
        Ruleset.rawRuleToCanonicalString(ruleData));
    //userRulesets.user.ruleset.print();
    //userRulesets.temp.ruleset.print();

    assertRuleAction(ruleAction);
    // TODO: check rule format validity
    // TODO: use noStore
    userRulesets.user.rawRuleset.removeRule(ruleAction, ruleData,
          userRulesets.user.ruleset);
    userRulesets.temp.rawRuleset.removeRule(ruleAction, ruleData,
          userRulesets.temp.ruleset);

    // TODO: only save if we actually removed a rule. This will require
    // modifying |RawRuleset.removeRule()| to indicate whether a rule
    // was removed.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
      RulesetStorage.saveRawRulesetToFile(
          userRulesets.user.rawRuleset, "user.json");
    }

    //userRulesets.user.ruleset.print();
    //userRulesets.temp.ruleset.print();

    notifyRulesChanged();
  };

  self.temporaryRulesExist = function() {
    return userRulesets.temp.rawRuleset.getAllowRuleCount() ||
           userRulesets.temp.rawRuleset.getDenyRuleCount();
  };

  self.revokeTemporaryRules = function() {
    var rawRuleset = new RawRuleset();
    userRulesets.temp = {
      "rawRuleset": rawRuleset,
      "ruleset": rawRuleset.toRuleset("temp")
    };
    userRulesets.temp.ruleset.userRuleset = true;

    notifyRulesChanged();
  };

  self.checkRequestAgainstUserRules = function(origin, dest) {
    return checkRequest(origin, dest, userRulesets);
  };

  self.checkRequestAgainstSubscriptionRules = function(origin, dest) {
    var result = new RequestResult();
    for (let listName in subscriptionRulesets) {
      let ruleset = subscriptionRulesets[listName];
      checkRequest(origin, dest, ruleset, result);
    }
    return result;
  };

  function checkRequest(origin, dest, aRuleset, result) {
    if (!(origin instanceof Ci.nsIURI)) {
      throw "Origin must be an nsIURI.";
    }
    if (!(dest instanceof Ci.nsIURI)) {
      throw "Destination must be an nsIURI.";
    }
    if (!result) {
      result = new RequestResult();
    }
    for (let name in aRuleset) {
      let {ruleset} = aRuleset[name];
      //ruleset.setPrintFunction(print);
      //ruleset.print();

      // TODO wrap this in a try/catch.
      let [tempAllows, tempDenies] = ruleset.check(origin, dest);
      // I'm not convinced I like appending these [ruleset, matchedRule] arrays,
      // but it works for now.
      for (let tempAllow of tempAllows) {
        result.matchedAllowRules.push([ruleset, tempAllow]);
      }
      for (let tempDeny of tempDenies) {
        result.matchedDenyRules.push([ruleset, tempDeny]);
      }
    }
    return result;
  }

  return self;
}());

PolicyManager = (function() {
  let scope = {
    PolicyManager: PolicyManager
  };
  Services.scriptloader.loadSubScript(
      "chrome://rpcontinued/content/lib/policy-manager.alias-functions.js",
      scope);
  return scope.PolicyManager;
}());
