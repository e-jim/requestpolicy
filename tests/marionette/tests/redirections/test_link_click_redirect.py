# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from marionette import SkipTest
import random


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestLinkClickRedirect(RequestPolicyTestCase):

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        finally:
            super(TestLinkClickRedirect, self).tearDown()

    ################
    # Test Methods #
    ################

    def test_r21n_appears_or_not__no_rules(self):
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

        self._test_appear(self._get_url("redirect-js-document-location-link.html",
                                        generate_page_with_link=False))

        self._test_appear(self._get_url("redirect-http-location-header.php"))
        self._test_appear(self._get_url("redirect-http-refresh-header.php"))
        self._test_appear(self._get_url("redirect-js-document-location-auto.html"))
        self._test_appear(self._get_url("redirect-meta-tag-01-immediate.html"))
        self._test_appear(self._get_url("redirect-meta-tag-02-delayed.html"))
        self._test_appear(self._get_url("redirect-meta-tag-03-multiple.html"))
        self._test_appear(self._get_url("redirect-meta-tag-08.html"))

        self._test_no_appear(self._get_url("redirect-meta-tag-04-relative-without-slash.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-05-relative-with-slash.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-06-different-formatting.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-07-different-formatting-delayed.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-09-relative.html"))

    def test_r21n_no_appears__conflicting_rules(self):
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, True)

        self.rules.create_rule({"o": {"h": "*.maindomain.test"},
                                "d": {"h": "*.otherdomain.test"}},
                               allow=True).add()
        self.rules.create_rule({"d": {"h": "*.otherdomain.test"}},
                               allow=False).add()

        self._test_no_appear(self._get_url("redirect-js-document-location-link.html",
                                           generate_page_with_link=False))
        self._test_no_appear(self._get_url("redirect-http-location-header.php"))
        self._test_no_appear(self._get_url("redirect-http-refresh-header.php"))
        self._test_no_appear(self._get_url("redirect-js-document-location-auto.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-01-immediate.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-02-delayed.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-03-multiple.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-04-relative-without-slash.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-05-relative-with-slash.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-06-different-formatting.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-07-different-formatting-delayed.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-08.html"))
        self._test_no_appear(self._get_url("redirect-meta-tag-09-relative.html"))

        self.rules.remove_all()

    def test_r21n_appear_then_no_appear(self):
        raise SkipTest("FIXME")
        # When fixed, remove the `append_random_querystring` option
        # of `_get_url()`.

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

        rule = self.rules.create_rule({"o": {"h": "*.maindomain.test"},
                                       "d": {"h": "*.otherdomain.test"}},
                                      allow=True)

        def test(test_filename):
            test_url = self._get_url(test_filename,
                                     append_random_querystring=False)
            self._test_appear(test_url)
            rule.add()
            self._test_no_appear(test_url)
            rule.remove()

        test("redirect-http-location-header.php")
        test("redirect-http-refresh-header.php")
        test("redirect-js-document-location-auto.html")
        test("redirect-meta-tag-01-immediate.html")
        test("redirect-meta-tag-02-delayed.html")
        test("redirect-meta-tag-03-multiple.html")
        test("redirect-meta-tag-08.html")

    ##########################
    # Private Helper Methods #
    ##########################

    def _test_no_appear(self, test_url):
        self._open_page_and_click_on_first_link(test_url)

        self.assertNotEqual(self.marionette.get_url(), test_url,
                            "The URL in the urlbar has changed.")
        self.assertFalse(self.redir.is_shown(),
                         "There's no redirect notification.")

    def _test_appear(self, test_url):
        self._open_page_and_click_on_first_link(test_url)

        self.assertTrue(self.redir.is_shown(),
                        "The redirect notification has been displayed.")

        self.redir.close()

    def _open_page_and_click_on_first_link(self, test_url):
        with self.marionette.using_context("content"):
            self.marionette.navigate(test_url)
            link = self.marionette.find_element("tag name", "a")
            link.click()

    def _get_url(self, path, generate_page_with_link=True,
                 append_random_querystring=True):
        if generate_page_with_link:
            path = "link.html?" + path
            if append_random_querystring:
                path = path + "?" + str(random.randint(1, 100))
        return "http://www.maindomain.test/" + path