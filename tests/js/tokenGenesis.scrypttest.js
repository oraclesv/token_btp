const { expect } = require('chai');
const {
  bsv,
  buildContractClass,
  getPreimage,
  toHex,
  SigHashPreimage,
  signTx,
  PubKey,
  Sig,
  Bytes,
  Ripemd160,
} = require('scryptlib');
const {
  loadDesc,
  inputSatoshis,
  tx,
  DataLen,
  dummyTxId,
  compileContract
} = require('../../helper');

const {
    privateKey,
    privateKey2,
} = require('../../privateKey');

const TokenProto = require('../../deployments/tokenProto')

// make a copy since it will be mutated
let tx_
const outputAmount = 222222

const tokenName = Buffer.alloc(10, 0)
tokenName.write('tcc')
const issuerPubKey = privateKey.publicKey
const genesisFlag = Buffer.from('01', 'hex')
const nonGenesisFlag = Buffer.from('00', 'hex')
const tokenType = Buffer.alloc(4, 0)
tokenType.writeUInt32LE(1)
const PROTO_FLAG = Buffer.from('oraclesv')
const Token = buildContractClass(loadDesc('tokenBtp_desc.json'))
const address1 = privateKey.toAddress()
const address2 = privateKey2.toAddress()
const tokenValue = 1000000
const buffValue = Buffer.alloc(8, 0)
buffValue.writeBigUInt64LE(BigInt(tokenValue))

describe('Test genesis contract unlock In Javascript', () => {
  let genesis, result, contractHash, tokenID, genesisScript

  before(() => {
    const Genesis = buildContractClass(loadDesc('tokenGenesis_desc.json'))
    const token = new Token()
    token.setDataPart(Buffer.alloc(TokenProto.getHeaderLen(), 0).toString('hex'))
    const lockingScript = token.lockingScript.toBuffer()
    const contractCode = TokenProto.getContractCode(lockingScript)
    contractHash = bsv.crypto.Hash.sha256ripemd160(contractCode)
    genesis = new Genesis(new PubKey(toHex(issuerPubKey)), new Bytes(tokenName.toString('hex')), new Bytes(contractHash.toString('hex')))
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      genesisFlag, 
      Buffer.alloc(20, 0), // address
      Buffer.alloc(8, 0), // token value
      Buffer.alloc(20, 0), // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    genesis.setDataPart(oracleData.toString('hex'))

    genesisScript = genesis.lockingScript
    tokenID = bsv.crypto.Hash.sha256ripemd160(genesisScript.toBuffer())

    tx_ = new bsv.Transaction()
    tx_.addInput(new bsv.Transaction.Input({
        prevTxId: dummyTxId,
        outputIndex: 0,
        script: ''
      }), bsv.Script.fromASM(genesisScript.toASM()), inputSatoshis)

  });

  it('should succeed', () => {
    const token = new Token()
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    token.setDataPart(oracleData.toString('hex'))
    const lockingScript = token.lockingScript
    tx_.addOutput(new bsv.Transaction.Output({
      script: lockingScript,
      satoshis: outputAmount
    }))

    const inIndex = 0
    const inputAmount = inputSatoshis

    const sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
    const preimage = getPreimage(tx_, genesisScript.toASM(), inputAmount, inputIndex=inIndex, sighashType=sigtype)
    const sig = signTx(tx_, privateKey, genesisScript.toASM(), inputAmount, inputIndex=inIndex, sighashType=sigtype)

    const txContext = { 
      tx: tx_, 
      inputIndex: inIndex, 
      inputSatoshis: inputAmount
    }

    result = genesis.unlock(new SigHashPreimage(toHex(preimage)), new Sig(toHex(sig)), new Bytes(lockingScript.toHex()), outputAmount).verify(txContext)
    expect(result.success, result.error).to.be.true
  });

  //it('should fail when pushing wrong preimage', () => {
  //  result = counter.increment(new SigHashPreimage(toHex(preimage) + '01'), outputAmount).verify()
  //  expect(result.success, result.error).to.be.false
  //});

  //it('should fail when pushing wrong amount', () => {
  //  result = counter.increment(new SigHashPreimage(toHex(preimage)), outputAmount - 1).verify()
  //  expect(result.success, result.error).to.be.false
  //});
});