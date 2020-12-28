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
let tx
const outputAmount = 222222

const tokenName = Buffer.alloc(10, 0)
tokenName.write('tcc')
const issuerPubKey = privateKey.publicKey
const genesisFlag = Buffer.from('01', 'hex')
const nonGenesisFlag = Buffer.from('00', 'hex')
const tokenType = Buffer.alloc(4, 0)
tokenType.writeUInt32LE(1)
const PROTO_FLAG = Buffer.from('oraclesv')
const Token = buildContractClass(compileContract('tokenBtp.scrypt'))
const address1 = privateKey.toAddress()
const address2 = privateKey2.toAddress()
const tokenValue = 1000
const tokenValue1 = 50
const tokenValue2 = tokenValue - tokenValue1
const buffValue = Buffer.alloc(8, 0)
buffValue.writeBigUInt64LE(BigInt(tokenValue))
const tokenID = Buffer.alloc(20, 0)
tokenID.write('testtokenid')
let tokenContract
let tokenScript

const outputSatoshis = 1000
function createTokenSplit(oracleData1, oracleData2, outSatoshis3, chargeAddress) {
  const token1 = new Token()
  token1.setDataPart(oracleData1.toString('hex'))
  const lockingScript1 = token1.lockingScript
  tx.addOutput(new bsv.Transaction.Output({
      script: lockingScript1,
      satoshis: outputSatoshis,
  }))

  let outToken1 = tokenValue1 + tokenValue2
  let outToken2 = 0
  let outSatoshis2 = 0
  if (oracleData2 !== null) {
    const token2 = new Token()
    token2.setDataPart(oracleData2.toString('hex'))
    const lockingScript2 = token2.lockingScript
    outToken1 = tokenValue1
    outToken2 = tokenValue2
    outSatoshis2 = outputSatoshis
    tx.addOutput(new bsv.Transaction.Output({
        script: lockingScript2,
        satoshis: outSatoshis2,
    }))
  }

  let chargeScript = Buffer.from('00', 'hex')
  if (outSatoshis3 > 0) {
    chargeScript = bsv.Script.buildPublicKeyHashOut(chargeAddress)
    tx.addOutput(new bsv.Transaction.Output({
      script: chargeScript,
      satoshis: outSatoshis3,
    }))
    chargeScript = chargeScript.toBuffer()
  }
  let sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  const preimage = getPreimage(tx, tokenScript.toASM(), inputSatoshis, inputIndex=0, sighashType=sigtype)
  let sig = signTx(tx, privateKey, tokenScript.toASM(), inputSatoshis, inputIndex=0, sighashType=sigtype)

  const txContext = { 
    tx: tx, 
    inputIndex: 0, 
    inputSatoshis: inputSatoshis 
  }

  const result = tokenContract.split(
    new SigHashPreimage(toHex(preimage)),
    new PubKey(toHex(privateKey.publicKey)),
    new Sig(toHex(sig)),
    new Ripemd160(address1.hashBuffer.toString('hex')),
    outToken1,
    outputSatoshis,
    new Ripemd160(address2.hashBuffer.toString('hex')),
    outToken2,
    outSatoshis2,
    new Bytes(chargeScript.toString('hex')),
    outSatoshis3,
  ).verify(txContext)
  return result
}

describe('Test token contract unlock In Javascript', () => {

  beforeEach(() => {
      tokenContract = new Token()
      tokenContract.setDataPart(Buffer.alloc(TokenProto.getHeaderLen(), 0).toString('hex'))
      const lockingScript = tokenContract.lockingScript.toBuffer()
      const contractCode = TokenProto.getContractCode(lockingScript)
      contractHash = bsv.crypto.Hash.sha256ripemd160(contractCode)

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
      tokenContract.setDataPart(oracleData.toString('hex'))
      tokenScript = tokenContract.lockingScript
      tx = new bsv.Transaction()
      tx.addInput(new bsv.Transaction.Input({
          prevTxId: dummyTxId,
          outputIndex: 0,
          script: ''
        }), bsv.Script.fromASM(tokenScript.toASM()), inputSatoshis)
  });
  it('should succeed with one output', () => {
    const bufValue1 = Buffer.alloc(8, 0)
    bufValue1.writeBigUInt64LE(BigInt(tokenValue1 + tokenValue2))
    const oracleData1 = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address1.hashBuffer, // address
      bufValue1, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createTokenSplit(oracleData1, null, 0, null)
    expect(result.success, result.error).to.be.true
  });

  it('should succeed with two output', () => {
    const bufValue1 = Buffer.alloc(8, 0)
    bufValue1.writeBigUInt64LE(BigInt(tokenValue1))
    const oracleData1 = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address1.hashBuffer, // address
      bufValue1, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const bufValue2 = Buffer.alloc(8, 0)
    bufValue2.writeBigUInt64LE(BigInt(tokenValue2))
    const oracleData2 = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address2.hashBuffer, // address
      bufValue2, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createTokenSplit(oracleData1, oracleData2, 0, null)
    expect(result.success, result.error).to.be.true
  });

  it('should succeed with three output', () => {
    const bufValue1 = Buffer.alloc(8, 0)
    bufValue1.writeBigUInt64LE(BigInt(tokenValue1))
    const oracleData1 = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address1.hashBuffer, // address
      bufValue1, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const bufValue2 = Buffer.alloc(8, 0)
    bufValue2.writeBigUInt64LE(BigInt(tokenValue2))
    const oracleData2 = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address2.hashBuffer, // address
      bufValue2, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createTokenSplit(oracleData1, oracleData2, outputSatoshis, address1)
    expect(result.success, result.error).to.be.true
  });

  it('should failed because input and output token amount not equal', () => {
    const bufValue1 = Buffer.alloc(8, 0)
    bufValue1.writeBigUInt64LE(BigInt(tokenValue1))
    const oracleData1 = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address1.hashBuffer, // address
      bufValue1, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const bufValue2 = Buffer.alloc(8, 0)
    bufValue2.writeBigUInt64LE(BigInt(tokenValue2 + 100))
    const oracleData2 = Buffer.concat([
      contractHash,
      tokenName,
      nonGenesisFlag, 
      address2.hashBuffer, // address
      bufValue2, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createTokenSplit(oracleData1, oracleData2, 0, null)
    expect(result.success, result.error).to.be.false

  })
});