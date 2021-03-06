var Application = require('..').Application
var assert = require('assert')
var fs = require('fs')
var helpers = require('./global-setup')
var path = require('path')
var temp = require('temp').track()

var describe = global.describe
var it = global.it
var beforeEach = global.beforeEach
var afterEach = global.afterEach
var expect = require('chai').expect

describe('application loading', function () {
  helpers.setupTimeout(this)

  var app = null
  var tempPath = null

  beforeEach(function () {
    tempPath = temp.mkdirSync('spectron-temp-dir-')

    return helpers.startApplication({
      args: [
        path.join(__dirname, 'fixtures', 'app'),
        '--foo',
        '--bar=baz'
      ],
      env: {
        FOO: 'BAR',
        HELLO: 'WORLD',
        SPECTRON_TEMP_DIR: tempPath
      }
    }).then(function (startedApp) { app = startedApp })
  })

  afterEach(function () {
    return helpers.stopApplication(app)
  })

  it('launches the application', function () {
    return app.client.windowHandles().then(function (response) {
      assert.equal(response.value.length, 1)
    }).getWindowBounds().should.eventually.deep.equal({
      x: 25,
      y: 35,
      width: 200,
      height: 100
    }).waitUntilTextExists('html', 'Hello')
      .getTitle().should.eventually.equal('Test')
  })

  it('passes through args to the launched app', function () {
    return app.client.getArgv()
      .should.eventually.contain('--foo')
      .should.eventually.contain('--bar=baz')
  })

  it('passes through env to the launched app', function () {
    var getEnv = function () { return process.env }
    return app.client.execute(getEnv).then(function (response) {
      if (process.platform === 'win32') {
        assert.equal(response.value.foo, 'BAR')
        assert.equal(response.value.hello, 'WORLD')
      } else {
        assert.equal(response.value.FOO, 'BAR')
        assert.equal(response.value.HELLO, 'WORLD')
      }
    })
  })

  describe('start()', function () {
    it('rejects with an error if the application does not exist', function () {
      return new Application({path: path.join(__dirname, 'invalid')})
        .start().should.be.rejectedWith(Error)
    })

    it('rejects with an error if ChromeDriver does not start within the specified timeout', function () {
      return new Application({path: helpers.getElectronPath(), host: 'bad.host', startTimeout: 150})
        .start().should.be.rejectedWith(Error, 'ChromeDriver did not start within 150ms')
    })
  })

  describe('stop()', function () {
    it('quits the application', function () {
      var quitPath = path.join(tempPath, 'quit.txt')
      assert.equal(fs.existsSync(quitPath), false)
      return app.stop().then(function () {
        assert.equal(fs.existsSync(quitPath), true)
      })
    })

    it('rejects with an error if the application is not running', function () {
      return app.stop().should.be.fulfilled.then(function () {
        return app.stop().should.be.rejectedWith(Error)
      })
    })
  })

  describe('getRenderProcessLogs', function () {
    it('gets the render process console logs and clears them', function () {
      return app.client.waitUntilWindowLoaded()
        .getRenderProcessLogs().then(function (logs) {
          expect(logs.length).to.equal(3)

          expect(logs[0].message).to.contain('7:15 render log')
          expect(logs[0].source).to.equal('console-api')
          expect(logs[0].level).to.equal('INFO')

          expect(logs[1].message).to.contain('8:15 render warn')
          expect(logs[1].source).to.equal('console-api')
          expect(logs[1].level).to.equal('WARNING')

          expect(logs[2].message).to.contain('9:15 render error')
          expect(logs[2].source).to.equal('console-api')
          expect(logs[2].level).to.equal('SEVERE')
        })
        .getRenderProcessLogs().then(function (logs) {
          expect(logs.length).to.equal(0)
        })
    })
  })

  describe('getMainProcessLogs', function () {
    it('gets the main process console logs and clears them', function () {
      return app.client.waitUntilWindowLoaded()
        .getMainProcessLogs().then(function (logs) {
          expect(logs).to.contain('main log')
          expect(logs).to.contain('main warn')
          expect(logs).to.contain('main error')
        })
        .getMainProcessLogs().then(function (logs) {
          expect(logs.length).to.equal(0)
        })
    })

    it('does not include any deprecation warnings', function () {
      return app.client.waitUntilWindowLoaded()
        .getMainProcessLogs().then(function (logs) {
          logs.forEach(function (log) {
            expect(log).not.to.contain('(electron)')
          })
        })
    })

    it('clears the logs when the application is stopped', function () {
      return app.stop().then(function () {
        expect(app.chromeDriver.getLogs().length).to.equal(0)
      })
    })
  })

  describe('getMainProcessGlobal', function () {
    it('returns the requested global from the main process', function () {
      return app.client
        .getMainProcessGlobal('mainProcessGlobal').should.eventually.equal('foo')
    })
  })
})
