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
let tokenScript

const outputSatoshis = 1000
function createTokenSplit(oracleData1, oracleData2) {
  let token = new Token()
  token.setDataPart(oracleData1.toString('hex'))
  const lockingScript1 = token.lockingScript
  tx.addOutput(new bsv.Transaction.Output({
      script: lockingScript1,
      satoshis: outputSatoshis,
  }))

  token = new Token()
  token.setDataPart(oracleData2.toString('hex'))
  const lockingScript2 = token.lockingScript
  tx.addOutput(new bsv.Transaction.Output({
      script: lockingScript2,
      satoshis: outputSatoshis,
  }))
  let sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  console.log("tx", tokenScript.toHex())
  const preimage = getPreimage(tx, tokenScript.toASM(), inputSatoshis, inputIndex=0, sighashType=sigtype)
  let sig = signTx(tx, privateKey, tokenScript.toASM(), inputSatoshis, inputIndex=0, sighashType=sigtype)

  const txContext = { 
    tx: tx, 
    inputIndex: 0, 
    inputSatoshis: inputSatoshis 
  }

  result = token.split(
    new SigHashPreimage(toHex(preimage)),
    new PubKey(toHex(privateKey.publicKey)),
    new Sig(toHex(sig)),
    new Ripemd160(address1.hashBuffer.toString('hex')),
    tokenValue1,
    outputSatoshis,
    new Ripemd160(address2.hashBuffer.toString('hex')),
    tokenValue2,
    outputSatoshis,
    new Bytes("00"),
    0,
  ).verify(txContext)
  return result
}

describe('Test token contract unlock In Javascript', () => {

  before(() => {
      const token = new Token()
      token.setDataPart(Buffer.alloc(TokenProto.getHeaderLen(), 0).toString('hex'))
      const lockingScript = token.lockingScript.toBuffer()
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
      token.setDataPart(oracleData.toString('hex'))
      tokenScript = token.lockingScript
      tx = new bsv.Transaction()
      tx.addInput(new bsv.Transaction.Input({
          prevTxId: dummyTxId,
          outputIndex: 0,
          script: ''
        }), bsv.Script.fromASM(tokenScript.toASM()), inputSatoshis)
  });

  it('should succeed', () => {
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
    const result = createTokenSplit(oracleData1, oracleData2)
    expect(result.success, result.error).to.be.true
  });
});