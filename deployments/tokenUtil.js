const {
  bsv,
  buildContractClass,
  getPreimage,
  toHex,
  num2bin,
  SigHashPreimage,
  signTx,
  PubKey,
  Sig,
  Bytes,
  Ripemd160,
} = require('scryptlib');

const {
    loadDesc,
} = require('../helper');

const TokenProto = require('./tokenProto')

const TokenUtil = module.exports

const genesisFlag = Buffer.from('01', 'hex')
const nonGenesisFlag = Buffer.from('00', 'hex')
const tokenType = Buffer.alloc(4, 0)
tokenType.writeUInt32LE(1)
const PROTO_FLAG = Buffer.from('oraclesv')

const dustLimit = 546

const Genesis = buildContractClass(loadDesc('tokenGenesis_desc.json'))
const Token = buildContractClass(loadDesc('tokenButp_desc.json'))

TokenUtil.getNewTokenScript = function(script, address, tokenAmount) {
  const scriptBuf = script.toBuffer()
  const amountBuf = Buffer.alloc(8, 0)
  amountBuf.writeBigUInt64LE(BigInt(tokenAmount))
  const newScript = Buffer.concat([
    scriptBuf.subarray(0, scriptBuf.length - TokenProto.TOKEN_ADDRESS_OFFSET),
    address.hashBuffer,
    amountBuf,
    scriptBuf.subarray(scriptBuf.length - TokenProto.TYPE_OFFSET, scriptBuf.length)
  ])
  return bsv.Script.fromBuffer(newScript)
}

TokenUtil.createGenesis = function(
  inputTxId, // input tx id 
  inputTxIndex, // input tx output index
  inputScript, // input tx locking script
  inputAmount,  // input tx satoshi
  inputPrivKey, // input unlocking private key
  fee, 
  issuerPubKey, // issuer public key
  tokenName, // token name you want
  genesisAmount, // geneis contract output satoshi
  chargeAddress, // charge bsv
  ) {
  const genesis = new Genesis(new PubKey(toHex(issuerPubKey)), new Bytes(tokenName.toString('hex')))
  const oracleData = Buffer.concat([
    tokenName,
    genesisFlag, 
    Buffer.alloc(20, 0), // address
    Buffer.alloc(8, 0), // token value
    Buffer.alloc(20, 0), // script code hash
    tokenType, // type
    PROTO_FLAG
  ])
  console.log('oracleData:', oracleData.toString('hex'))
  genesis.setDataPart(oracleData.toString('hex'))

  const chargeAmount = inputAmount - genesisAmount - fee
  const genesisScript = genesis.lockingScript
  console.log('genesisScript:', genesisScript.toHex())

  const tx = new bsv.Transaction()
  tx.addInput(new bsv.Transaction.Input.PublicKeyHash({
    output: new bsv.Transaction.Output({
      script: inputScript,
      satoshis: inputAmount
    }),
    prevTxId: inputTxId,
    outputIndex: inputTxIndex,
    script: bsv.Script.empty()
  }))

  tx.addOutput(new bsv.Transaction.Output({
    script: genesisScript,
    satoshis: genesisAmount,
  }))

  tx.addOutput(new bsv.Transaction.Output({
    script: bsv.Script.buildPublicKeyHashOut(chargeAddress),
    satoshis: chargeAmount,
  }))

  const sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  const hashData = bsv.crypto.Hash.sha256ripemd160(inputPrivKey.publicKey.toBuffer())
  const sig = tx.inputs[0].getSignatures(tx, inputPrivKey, 0, sigtype, hashData)
  tx.inputs[0].addSignature(tx, sig[0])

  return tx
}

TokenUtil.createToken = function(
  genesisScript, // genesis tx output script
  tokenValue,  // the token amount want to create
  address, // token create address
  inputAmount, // genesis tx input satoshi
  genesisTxId, // genesis tx id
  genesisTxOutputIndex, // genesis tx outputIndex
  outputAmount, // token output satoshi
  issuerPrivKey // issuer private key
  ) {
  const tokenContract = new Token()

  const scriptBuffer = genesisScript.toBuffer()
  const tokenName = TokenProto.getTokenName(scriptBuffer)

  const tokenID = Buffer.from(bsv.crypto.Hash.sha256ripemd160(genesisScript.toBuffer()))

  const buffValue = Buffer.alloc(8, 0)
  buffValue.writeBigUInt64LE(BigInt(tokenValue))
  const oracleData = Buffer.concat([
    Buffer.from(tokenName),
    nonGenesisFlag, // genesis flag
    address.hashBuffer, // address
    buffValue, // token value
    tokenID, // script code hash
    tokenType, // type
    PROTO_FLAG
  ])
  tokenContract.setDataPart(oracleData.toString('hex'))

  const tx = new bsv.Transaction()
  tx.addInput(new bsv.Transaction.Input({
    output: new bsv.Transaction.Output({
      script: genesisScript,
      satoshis: inputAmount
    }),
    prevTxId: genesisTxId,
    outputIndex: genesisTxOutputIndex,
    script: bsv.Script.empty(), // placeholder
  }))

  const lockingScript = tokenContract.lockingScript
  tx.addOutput(new bsv.Transaction.Output({
    script: lockingScript,
    satoshis: outputAmount,
  }))

  const sigtype = bsv.crypto.Signature.SIGHASH_SINGLE | bsv.crypto.Signature.SIGHASH_FORKID
  const preimage = getPreimage(tx, genesisScript.toASM(), inputAmount, inputIndex=genesisTxOutputIndex, sighashType=sigtype)
  const sig = signTx(tx, issuerPrivKey, genesisScript.toASM(), inputAmount, inputIndex=genesisTxOutputIndex, sighashType=sigtype)

  // TODO: get genesis from the script code
  const issuerPubKey = issuerPrivKey.publicKey
  const genesis = new Genesis(new PubKey(toHex(issuerPubKey)), new Bytes(Buffer.from(tokenName).toString('hex')))
  const unlockingScript = genesis.unlock(
      new SigHashPreimage(toHex(preimage)),
      new Sig(toHex(sig)),
      new Bytes(lockingScript.toHex())
  ).toScript()

  tx.inputs[0].setScript(unlockingScript)

  return tx
}

TokenUtil.createTokenTransfer = function(
  tokenTxId, // input token tx id
  tokenTxOutputIndex,
  tokenScript, // input token contract locking script
  inputAmount1, // token input amount
  senderPrivKey,
  feeTxId,
  feeTxOutputIndex,
  feeScript, // input fee script
  inputAmount2, // input tx to provide fee
  feeTxPrivKey, 
  fee,
  address1, // first token output address
  tokenAmount1, // first token output amount
  outputAmount1, // first token output satoshi
  address2, // second token output address
  tokenAmount2, // second output tokenAmount
  outputAmount2, // second token output satoshi
  chargeAddress, // charge bsv address
) {
  const tx = new bsv.Transaction()

  // token contract input
  tx.addInput(new bsv.Transaction.Input({
      output: new bsv.Transaction.Output({
        script: tokenScript,
        satoshis: inputAmount1
      }),
      prevTxId: tokenTxId,
      outputIndex: tokenTxOutputIndex,
      script: bsv.Script.empty()
  }))

  // bsv input to provide fee
  tx.addInput(new bsv.Transaction.Input.PublicKeyHash({
    output: new bsv.Transaction.Output({
      script: feeScript,
      satoshis: inputAmount2
    }),
    prevTxId: feeTxId,
    outputIndex: feeTxOutputIndex,
    script: bsv.Script.empty()
  }))

  // first token output
  const lockingScript1 = TokenUtil.getNewTokenScript(tokenScript, address1, tokenAmount1)
  tx.addOutput(new bsv.Transaction.Output({
      script: lockingScript1,
      satoshis: outputAmount1,
  }))

  // seconde token output
  if (tokenAmount2 > 0) {
    const lockingScript2 = TokenUtil.getNewTokenScript(tokenScript, address2, tokenAmount2)
    tx.addOutput(new bsv.Transaction.Output({
        script: lockingScript2,
        satoshis: outputAmount2,
    }))
  }

  let chargeAmount = inputAmount1 + inputAmount2 - outputAmount1 - outputAmount2 - fee

  let chargeScript = null
  if (chargeAmount >= dustLimit) {
    chargeScript = bsv.Script.buildPublicKeyHashOut(chargeAddress)
    tx.addOutput(new bsv.Transaction.Output({
      script: chargeScript,
      satoshis: chargeAmount,
    }))
    chargeScript = chargeScript.toHex()
  } else {
    chargeAmount = 0
    chargeScript = '00'
  }

  let sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  const preimage = getPreimage(tx, tokenScript.toASM(), inputAmount1, inputIndex=tokenTxOutputIndex, sighashType=sigtype)
  let sig = signTx(tx, senderPrivKey, tokenScript.toASM(), inputAmount1, inputIndex=tokenTxOutputIndex, sighashType=sigtype)

  const tokenContract = new Token()
  const unlockingScript = tokenContract.split(
      new SigHashPreimage(toHex(preimage)),
      new PubKey(senderPrivKey.publicKey),
      new Sig(toHex(sig)),
      new Ripemd160(address1.hashBuffer.toString('hex')),
      tokenAmount1,
      outputAmount1,
      new Ripemd160(address2.hashBuffer.toString('hex')),
      tokenAmount2,
      outputAmount2,
      new Bytes(chargeScript),
      chargeAmount,
  ).toScript()
  tx.inputs[0].setScript(unlockingScript)

  const sigtype2 = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  const hashData = bsv.crypto.Hash.sha256ripemd160(feeTxPrivKey.publicKey.toBuffer())
  const sig2 = tx.inputs[1].getSignatures(tx, feeTxPrivKey, feeTxOutputIndex, sigtype2, hashData)
  tx.inputs[1].addSignature(tx, sig2[0])

  return tx
}