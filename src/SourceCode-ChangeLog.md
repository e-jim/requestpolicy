### Source Code ChangeLog of RequestPolicyContinued

Note: The ChangeLog relevant for users you can find in the parent directory.

#### Version 1.0.beta11
* Switch from "preprocessor.js" to "preprocess.py". (#693, a51d59b)
* JSHint and JSCS are now used for static code analysis. (c8f1da1, 45f969c)


#### Version 1.0.beta10
* The extension ID (GUID) has changed. At the same time, several other
  relevant "names" have been changed. (#609)
  * The ID:
    * old ID: `requestpolicy@requestpolicy.com`
    * new IDs:
       * AMO-release:     `rpcontinued@requestpolicy.org`
       * off-AMO release: `rpcontinued@non-amo.requestpolicy.org`
  * The "chrome://" URI
    * Old: `chrome://requestpolicy/`
    * New: `chrome://rpcontinued/`
* The localization (l10n) of the add-on description is now
  in `install.rdf`. (600825b)


#### Version 1.0.beta9
* build process
  * change from `ant` to `make`
  * usage of npm package `preprocessor`
* restartlessness: The addon is now restartless! This brought
  many more changes, they aren't documented though.
* All files have been renamed to be lowercase.
* The nsIRequestPolicy interface and its functions have been removed.


#### Version 1.0.beta8
* The functionality of `shouldLoad()` has been moved to `RequestProcessor`.
  `shouldLoad()` creates an object of the new `NormalRequest` prototype and
  passes it to `RequestProcessor.process()`.
  Besides `NormalRequest`, `RedirectRequest` has been created and is used by
  `RequestProcessor._examineHttpResponse()`.
* `RequestResult` has been moved to a separate file.
* several variables and functions have been renamed:
  * `RuleSet` → `Rules` (050ec75)
  * `Policy` → `Ruleset` (c69744e)
  * `rule type` → `rule action` (=allow/deny) (71bcb49)


#### Version 1.0.0b7 (changes since 1.0.0b3)
* forked version 1.0.0b3 from
  https://github.com/RequestPolicy/requestpolicy/tree/dev-1.0
* whitespace at the end of the lines removed (c5c1551)
* use `nsIURI.specIgnoringRef` instead of
  `DomainUtil.stripFragment(nsIURI.spec)` (384eeea)
* renamed `Address` to `IPAddress` to reduce confusion (4ad62fb)
* `CheckRequestResult` renamed to `RequestResult` (6182689)
* the variable `RequestSet._origins` got one additional layer. It's now
  `[originURI][destBase][destIdent][destURI][i]`. This allows counting also
  the number of duplicate requests. (64a419a)
