import test from 'tape'
import sinon from 'sinon'
import Promise from 'bluebird'

import runSpaceSync from '../lib/run-space-sync'
import errorBuffer from 'contentful-batch-libs/utils/error-buffer'

const sourceResponse = {
  nextSyncToken: 'nextsynctoken',
  contentTypes: [
    {original: {sys: {id: 'exists'}}}
  ],
  locales: [{original: {code: 'en-US'}}]
}
const destinationResponse = {
  contentTypes: [
    {sys: {id: 'exists'}},
    {sys: {id: 'doesntexist'}}
  ],
  locales: [{code: 'en-US'}, {code: 'en-GB'}]
}

const createClientsStub = sinon.stub().returns({ source: {delivery: {}}, destination: {management: {}} })
runSpaceSync.__Rewire__('createClients', createClientsStub)

const getSourceSpaceViaSyncStub = sinon.stub().returns(Promise.resolve(sourceResponse))
runSpaceSync.__Rewire__('getSourceSpaceViaSync', getSourceSpaceViaSyncStub)

const getTransformedDestinationResponseStub = sinon.stub().returns(Promise.resolve(destinationResponse))
runSpaceSync.__Rewire__('getTransformedDestinationResponse', getTransformedDestinationResponseStub)

const transformSpaceStub = sinon.stub().returns(Promise.resolve(sourceResponse))
runSpaceSync.__Rewire__('transformSpace', transformSpaceStub)

const pushToSpaceStub = sinon.stub().returns(Promise.resolve({}))
runSpaceSync.__Rewire__('pushToSpace', pushToSpaceStub)

const dumpErrorBufferStub = sinon.stub()
runSpaceSync.__Rewire__('dumpErrorBuffer', dumpErrorBufferStub)

const fsMock = {
  writeFileSync: sinon.stub()
}
runSpaceSync.__Rewire__('fs', fsMock)

test('Runs space sync', (t) => {
  const preparedResponses = {
    sourceContent: {
      deletedContentTypes: [{sys: {id: 'doesntexist'}}],
      deletedLocales: [{code: 'en-GB'}],
      contentTypes: [{original: {sys: {id: 'exists'}}}],
      locales: [{original: {code: 'en-US'}}],
      nextSyncToken: 'nextsynctoken'
    },
    destinationContent: Object.assign({}, destinationResponse)
  }

  errorBuffer.push({
    request: {
      uri: 'erroruri'
    }
  })

  runSpaceSync({
    opts: {},
    syncTokenFile: 'synctokenfile',
    errorLogFile: 'errorlogfile'
  })
    .then(() => {
      t.ok(createClientsStub.called, 'creates clients')
      t.ok(getSourceSpaceViaSyncStub.called, 'gets source space')
      t.ok(getTransformedDestinationResponseStub.called, 'gets destination space')
      t.ok(transformSpaceStub.called, 'transforms space')
      t.deepLooseEqual(pushToSpaceStub.args[0][0].sourceContent, preparedResponses.sourceContent, 'sends source content to destination space')
      t.deepLooseEqual(pushToSpaceStub.args[0][0].destinationContent, preparedResponses.destinationContent, 'sends destination content to destination space')
      t.ok(fsMock.writeFileSync.calledWith('synctokenfile', 'nextsynctoken'), 'token file created')
      t.ok(dumpErrorBufferStub.called, 'error objects are logged')

      runSpaceSync.__ResetDependency__('createClients')
      runSpaceSync.__ResetDependency__('getSourceSpaceViaSync')
      runSpaceSync.__ResetDependency__('getTransformedDestinationResponse')
      runSpaceSync.__ResetDependency__('transformSpace')
      runSpaceSync.__ResetDependency__('pushToSpace')
      runSpaceSync.__ResetDependency__('dumpErrorBuffer')
      runSpaceSync.__ResetDependency__('fs')
      t.end()
    })
})
