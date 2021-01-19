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
} = require('scryptlib');
const {
  loadDesc,
  inputSatoshis,
  dummyTxId,
  compileContract
} = require('../../helper');

const {
    privateKey,
} = require('../../privateKey');

const TokenProto = require('../../deployments/tokenProto')

// MSB of the sighash  due to lower S policy
const MSB_THRESHOLD = 0x7E
// make a copy since it will be mutated
let tx
const outputAmount = 222222

const tokenName = Buffer.alloc(20, 0)
tokenName.write('test token name')
const tokenSymbol = Buffer.alloc(10, 0)
tokenSymbol.write('ttn')
const issuerPubKey = privateKey.publicKey
const genesisFlag = Buffer.from('01', 'hex')
const nonGenesisFlag = Buffer.from('00', 'hex')
const tokenType = Buffer.alloc(4, 0)
tokenType.writeUInt32LE(1)
const PROTO_FLAG = Buffer.from('oraclesv')
const Token = buildContractClass(compileContract('tokenBtp.scrypt'))
const address1 = privateKey.toAddress()
const tokenValue = 1000000
const buffValue = Buffer.alloc(8, 0)
buffValue.writeBigUInt64LE(BigInt(tokenValue))
const decimalNum = Buffer.from('08', 'hex')

let genesis, result, contractHash, tokenID, genesisScript

function createToken(oracleData) {
  const token = new Token()
  token.setDataPart(oracleData.toString('hex'))
  const lockingScript = token.lockingScript
  tx.addOutput(new bsv.Transaction.Output({
    script: lockingScript,
    satoshis: outputAmount
  }))

  const inIndex = 0
  const inputAmount = inputSatoshis

  const sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  let preimage
  // preimage optimize
  for (let i = 0; ; i++) {
    tx.nLockTime = i
    const preimage_ = getPreimage(tx, genesisScript.toASM(), inputAmount, inputIndex=inIndex, sighashType=sigtype)
    const preimageHex = toHex(preimage_)
    const h = bsv.crypto.Hash.sha256sha256(Buffer.from(preimageHex, 'hex'))
    const msb = h.readUInt8()
    if (msb < MSB_THRESHOLD) {
        // the resulting MSB of sighash must be less than the threshold
        preimage = preimage_
        break
    }
  }
  const sig = signTx(tx, privateKey, genesisScript.toASM(), inputAmount, inputIndex=inIndex, sighashType=sigtype)

  const txContext = { 
    tx: tx, 
    inputIndex: inIndex, 
    inputSatoshis: inputAmount
  }

  result = genesis.unlock(new SigHashPreimage(toHex(preimage)), new Sig(toHex(sig)), new Bytes(lockingScript.toHex()), outputAmount).verify(txContext)
  return result
}

function getOracleData(address, tokenAmount) {
  tokenAmountBuf = Buffer.alloc(8, 0)
  tokenAmountBuf.writeBigUInt64LE(BigInt(tokenAmount))
  const oracleData = Buffer.concat([
    contractHash,
    tokenName,
    tokenSymbol,
    genesisFlag, 
    decimalNum,
    address,
    tokenAmountBuf,
    tokenID,
    tokenType, // type
    PROTO_FLAG
  ])
  return oracleData
}

describe('Test genesis contract unlock In Javascript', () => {

  beforeEach(() => {
    const Genesis = buildContractClass(compileContract('tokenGenesis.scrypt'))
    const token = new Token()
    token.setDataPart(Buffer.alloc(TokenProto.getHeaderLen(), 0).toString('hex'))
    const lockingScript = token.lockingScript.toBuffer()
    const contractCode = TokenProto.getContractCode(lockingScript)
    contractHash = bsv.crypto.Hash.sha256ripemd160(contractCode)
    genesis = new Genesis(new PubKey(toHex(issuerPubKey)), new Bytes(tokenName.toString('hex')), new Bytes(tokenSymbol.toString('hex')), new Bytes(contractHash.toString('hex')), decimalNum.readUInt8())
    console.log('contract hash:', contractHash.toString('hex'))
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      tokenSymbol,
      genesisFlag, 
      decimalNum,
      Buffer.alloc(20, 0), // address
      Buffer.alloc(8, 0), // token value
      Buffer.alloc(20, 0), // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    genesis.setDataPart(oracleData.toString('hex'))

    genesisScript = genesis.lockingScript
    tokenID = bsv.crypto.Hash.sha256ripemd160(genesisScript.toBuffer())

    tx = new bsv.Transaction()
    tx.addInput(new bsv.Transaction.Input({
        prevTxId: dummyTxId,
        outputIndex: 0,
        script: ''
      }), bsv.Script.fromASM(genesisScript.toASM()), inputSatoshis)

  });

  it('should succeed', () => {
    const oracleData = getOracleData(address1.hashBuffer, tokenValue)
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.true
  });

  it('should fail when get wrong contractHash', () => {
    const oracleData = Buffer.concat([
      Buffer.alloc(contractHash.length, 0),
      tokenName,
      tokenSymbol,
      nonGenesisFlag, 
      decimalNum,
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });

  it('should failed when get wrong tokenName', () => {
    const oracleData = Buffer.concat([
      contractHash,
      Buffer.alloc(tokenName.length, 0),
      tokenSymbol,
      nonGenesisFlag, 
      decimalNum,
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });

  it('should failed when get wrong tokenSymbol', () => {
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      Buffer.alloc(tokenSymbol.length, 0),
      nonGenesisFlag, 
      decimalNum,
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });

  it('should failed when get wrong genesis flag', () => {
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      tokenSymbol,
      genesisFlag, 
      decimalNum,
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });
  it('should failed when get wrong tokenID', () => {
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      tokenSymbol,
      nonGenesisFlag, 
      decimalNum,
      address1.hashBuffer, // address
      buffValue, // token value
      Buffer.alloc(tokenID.length, 0), // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });
  it('should failed when get wrong tokenType', () => {
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      tokenSymbol,
      nonGenesisFlag, 
      decimalNum,
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      Buffer.alloc(tokenType.length, 0), // type
      PROTO_FLAG
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });
  it('should failed when get wrong proto flag', () => {
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      tokenSymbol,
      nonGenesisFlag, 
      decimalNum,
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      Buffer.alloc(PROTO_FLAG.length, 0)
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });
  it('should failed when get wrong decimalNum', () => {
    const oracleData = Buffer.concat([
      contractHash,
      tokenName,
      tokenSymbol,
      nonGenesisFlag, 
      Buffer.from('01', 'hex'),
      address1.hashBuffer, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      Buffer.alloc(PROTO_FLAG.length, 0)
    ])
    const result = createToken(oracleData)
    expect(result.success, result.error).to.be.false
  });
});