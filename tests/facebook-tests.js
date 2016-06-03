'use strict';
import sinon from 'sinon';
import assert from 'assert';
import Facebook from './../src/facebook';
import ResourceManager from 'resource-manager-js';
import _ from 'lodash';
import {Promise} from 'es6-promise';
import async from 'async-promises';

describe('Facebook', function () {

    let origFB;
    let resourceManagerLoadScriptStub;
    let loadScriptTrigger = {};

    beforeEach(function () {
        origFB = window.FB;
        window.FB = {
            init: sinon.spy(),
            login: sinon.stub()
        };
        resourceManagerLoadScriptStub = sinon.stub(ResourceManager, 'loadScript');
        resourceManagerLoadScriptStub.returns(new Promise((resolve) => {
            loadScriptTrigger.resolve = resolve;
        }));
    });

    afterEach(function () {
        window.FB = origFB;
        resourceManagerLoadScriptStub.restore();
    });

    it('should call ResourceManager\'s loadScript method with the correct url to the facebook js script', function () {
        Facebook.load();
        assert.ok(resourceManagerLoadScriptStub.calledWith('//connect.facebook.net/en_US/sdk.js'));
        Facebook.unload();
    });

    it('should load the FB object with default options when api is loaded', function (done) {
        Facebook.load();
        _.defer(() => {
            window.fbAsyncInit(); //trigger api load
            var FBInitOptions = window.FB.init.args[0][0];
            assert.equal(FBInitOptions.xfbml, true, 'object passed FB.init() includes xfbml property set to "true"');
            assert.equal(FBInitOptions.version, 'v2.1', 'object passed FB.init() includes version set to "v2.1"');
            Facebook.unload();
            done();
        });
    });

    it('should load the FB object with appId specified in options when api is loaded', function (done) {
        var id = 'myFacebookAppId';
        Facebook.load({appId: id});
        _.defer(() => {
            window.fbAsyncInit(); //trigger api load
            var FBInitOptions = window.FB.init.args[0][0];
            assert.equal(FBInitOptions.appId, id);
            Facebook.unload();
            done();
        });
    });

    it('should resolve the load promise only when ResourceManager\'s loadScript method resolves and fbAsyncInit has been triggered', function (done) {
        var loadSpy = sinon.spy();
        Facebook.load().then(loadSpy);
        _.defer(() => {
            assert.equal(loadSpy.callCount, 0, 'load hasnt resolved because ResourceManager loadScript hasnt resolved');
            loadScriptTrigger.resolve();
            assert.equal(loadSpy.callCount, 0, 'load still hasnt resolved after ResourceManager loadScript is resolved because fbAsyncInit hasnt been triggered');
            window.fbAsyncInit(); // trigger api load
            _.defer(() => {
                assert.ok(loadSpy.calledWith(window.FB), 'load is resolved with FB object when fbAsyncInit is triggered');
                Facebook.unload();
                done();
            });
        });
    });

    it('passing a permission into login should pass appropriate scope permission to the FB.login', function () {
        resourceManagerLoadScriptStub.returns(Promise.resolve());
        var resp = {authResponse: {}};
        window.FB.login.yields(resp);
        // ensure fbAsyncInit is called immediately
        Object.defineProperty(window, 'fbAsyncInit', {
            configurable: true,
            set: function (func) {
                func();
            }
        });
        var perms = {
            createPosts: 'publish_actions',
            readPosts: 'user_posts',
            updatePosts: 'publish_actions',
            deletePosts: 'publish_actions',
            readProfile: 'public_profile',
            readFriendProfiles: 'user_friends'
        };
        var keys = Object.keys(perms);
        var callIndex = 0;
        return async.eachSeries(keys, (internalPermission) => {
            return Facebook.login({permissions: [internalPermission]}).then(() => {
                let facebookPermission = perms[internalPermission];
                assert.equal(window.FB.login.args[callIndex][1].scope, facebookPermission, 'passing permission "' + internalPermission + '" gets passed to FB.login scope as "' + facebookPermission + '"');
                callIndex++;
            });
        }).then(() => {
            Facebook.unload();
        })
    });

    it('multiple permissions passed into login should be converted to comma-seperated values to the FB.login', function () {
        resourceManagerLoadScriptStub.returns(Promise.resolve());
        var resp = {authResponse: {}};
        window.FB.login.yields(resp);
        // ensure fbAsyncInit is called immediately
        Object.defineProperty(window, 'fbAsyncInit', {
            configurable: true,
            set: function (func) {
                func();
            }
        });
        // choose multiple permissions that would match different permissions
        var testPermissions = ['createPosts', 'readPosts'];
        return Facebook.login({permissions: testPermissions}).then(() => {
            assert.equal(window.FB.login.args[0][1].scope, 'publish_actions,user_posts');
            Facebook.unload();
        });
    });

    it('multiple permissions with the same mapped value passed into login should only return the mapped value once in the scope passed to FB.login', function () {
        resourceManagerLoadScriptStub.returns(Promise.resolve());
        var resp = {authResponse: {}};
        window.FB.login.yields(resp);
        // ensure fbAsyncInit is called immediately
        Object.defineProperty(window, 'fbAsyncInit', {
            configurable: true,
            set: function (func) {
                func();
            }
        });
        // choose multiple permissions with same mapped value
        var testPermissions = ['createPosts', 'updatePosts'];
        return Facebook.login({permissions: testPermissions}).then(() => {
            assert.equal(window.FB.login.args[0][1].scope, 'publish_actions');
            Facebook.unload();
        });
    });

    it('should resolve login promise with appropriate object when a authResponse exists in the FB.login callback', function () {
        resourceManagerLoadScriptStub.returns(Promise.resolve());
        var resp = {
            authResponse: {
                accessToken: 'blurr',
                userId: 'blurr',
                expiresIn: Date.now()
            }
        };
        window.FB.login.yields(resp);
        // ensure fbAsyncInit is called immediately
        Object.defineProperty(window, 'fbAsyncInit', {
            configurable: true,
            set: function (func) {
                func();
            }
        });
        return Facebook.login().then((assertResp) => {
            assert.equal(assertResp.accessToken, resp.authResponse.accessToken);
            assert.equal(assertResp.userId, resp.authResponse.userId);
            assert.equal(assertResp.expiresAt, resp.authResponse.expiresIn);
            Facebook.unload();
        })
    });

    it('should reject login promise when an authResponse object does not exist in the FB.login callback', function (done) {
        resourceManagerLoadScriptStub.returns(Promise.resolve());
        window.FB.login.yields({});
        // ensure fbAsyncInit is called immediately
        Object.defineProperty(window, 'fbAsyncInit', {
            configurable: true,
            set: function (func) {
                func();
            }
        });
        var rejectSpy = sinon.spy();
        Facebook.login().catch(rejectSpy);
        _.defer(() => {
            assert.equal(rejectSpy.callCount, 1);
            Facebook.unload();
            done();
        })
    });
});

