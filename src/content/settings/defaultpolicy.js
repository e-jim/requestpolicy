/* global window, $, common, WinEnv, elManager, $id */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {Prefs} = importModule("models/prefs");

  //============================================================================

  var PAGE_STRINGS = [
    "yourPolicy",
    "defaultPolicy",
    "subscriptions",
    "allowRequestsByDefault",
    "blockRequestsByDefault",
    "defaultPolicyDefinition",
    "learnMore",
    "allowRequestsToTheSameDomain",
    "differentSubscriptionsAreAvailable",
    "manageSubscriptions"
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function updateDisplay() {
    var defaultallow = Prefs.get("defaultPolicy.allow");
    if (defaultallow) {
      $id("defaultallow").checked = true;
      $id("defaultdenysetting").hidden = true;
    } else {
      $id("defaultdeny").checked = true;
      $id("defaultdenysetting").hidden = false;
    }

    var allowsamedomain = Prefs.get("defaultPolicy.allowSameDomain");
    $id("allowsamedomain").checked = allowsamedomain;
  }

  function showManageSubscriptionsLink() {
    $id("subscriptionschanged").style.display = "block";
  }

  window.onload = function() {
    updateDisplay();

    elManager.addListener(
        $id("defaultallow"), "change",
        function(event) {
          var allow = event.target.checked;
          Prefs.set("defaultPolicy.allow", allow);
          Services.prefs.savePrefFile(null);
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("defaultdeny"), "change",
        function(event) {
          var deny = event.target.checked;
          Prefs.set("defaultPolicy.allow", !deny);
          Services.prefs.savePrefFile(null);
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("allowsamedomain"), "change",
        function(event) {
          var allowSameDomain = event.target.checked;
          Prefs.set("defaultPolicy.allowSameDomain",
              allowSameDomain);
          Services.prefs.savePrefFile(null);
        });

    // call updateDisplay() every time a preference gets changed
    WinEnv.prefObs.addListener("", updateDisplay);
  };

}());
