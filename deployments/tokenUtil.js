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
    compileContract
} = require('../helper');


const TokenProto = require('./tokenProto')

const TokenUtil = module.exports

const genesisFlag = Buffer.from('01', 'hex')
const nonGenesisFlag = Buffer.from('00', 'hex')
const tokenType = Buffer.alloc(4, 0)
tokenType.writeUInt32LE(1)
const PROTO_FLAG = Buffer.from('oraclesv')
// MSB of the sighash  due to lower S policy
const MSB_THRESHOLD = 0x7E

const Genesis = buildContractClass(loadDesc('tokenGenesis_desc.json'))
const Token = buildContractClass(loadDesc('tokenBtp_desc.json'))
//const Genesis = buildContractClass(compileContract('tokenGenesis.scrypt'))
//const Token = buildContractClass(compileContract('tokenBtp.scrypt'))

let genesisContract

TokenUtil.getTokenContractHash = function() {
  const token = new Token()
  token.setDataPart(Buffer.alloc(TokenProto.getHeaderLen(), 0).toString('hex'))
  const lockingScript = token.lockingScript.toBuffer()
  const contractCode = TokenProto.getContractCode(lockingScript)
  const contractHash = bsv.crypto.Hash.sha256ripemd160(contractCode)
  return contractHash
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
  contractHash, // token contract hash
  genesisAmount, // geneis contract output satoshi
  chargeAddress, // charge bsv
  decimalNum, // token amount decimal num
  ) {
  const decimalBuf = Buffer.alloc(1, 0)
  decimalBuf.writeUInt8(decimalNum)
  const genesis = new Genesis(new PubKey(toHex(issuerPubKey)), new Bytes(tokenName.toString('hex')), new Bytes(contractHash.toString('hex')), decimalNum)
  console.log('genesis create args:', toHex(issuerPubKey), tokenName.toString('hex'), contractHash.toString('hex'), decimalNum)
  const oracleData = Buffer.concat([
    contractHash,
    tokenName,
    genesisFlag, 
    decimalBuf,
    Buffer.alloc(20, 0), // address
    Buffer.alloc(8, 0), // token value
    Buffer.alloc(20, 0), // script code hash
    tokenType, // type
    PROTO_FLAG
  ])
  console.log('oracleData:', oracleData.toString('hex'))
  genesis.setDataPart(oracleData.toString('hex'))
  console.log('genesis data part:', oracleData.toString('hex'))

  genesisContract = genesis

  const changeAmount = inputAmount - genesisAmount - fee
  const genesisScript = genesis.lockingScript
  //console.log('genesisScript:', genesisScript.toHex())

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
    satoshis: changeAmount,
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
  outputSatoshis, // token output satoshi
  issuerPrivKey, // issuer private key
  decimalNum  // token amount decimal num
  ) {
  const tokenContract = new Token()

  const scriptBuffer = genesisScript.toBuffer()
  const tokenName = TokenProto.getTokenName(scriptBuffer)

  const tokenID = Buffer.from(bsv.crypto.Hash.sha256ripemd160(genesisScript.toBuffer()))

  const decimalBuf = Buffer.alloc(1, 0)
  decimalBuf.writeUInt8(decimalNum)
  const buffValue = Buffer.alloc(8, 0)
  buffValue.writeBigUInt64LE(BigInt(tokenValue))
  const contractHash = TokenProto.getContractHash(scriptBuffer)
  const oracleData = Buffer.concat([
    contractHash,
    Buffer.from(tokenName),
    nonGenesisFlag, // genesis flag
    decimalBuf,
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
      satoshis: inputAmount,
    }),
    prevTxId: genesisTxId,
    outputIndex: genesisTxOutputIndex,
    script: bsv.Script.empty(), // placeholder
  }))

  const lockingScript = tokenContract.lockingScript
  tx.addOutput(new bsv.Transaction.Output({
    script: lockingScript,
    satoshis: outputSatoshis,
  }))

  const sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  let preimage
  // preimage optimize
  for (let i = 0; ; i++) {
    tx.nLockTime = i
    const preimage_ = getPreimage(tx, genesisScript.toASM(), inputAmount, inputIndex=genesisTxOutputIndex, sighashType=sigtype)
    const preimageHex = toHex(preimage_)
    const h = bsv.crypto.Hash.sha256sha256(Buffer.from(preimageHex, 'hex'))
    const msb = h.readUInt8()
    if (msb < MSB_THRESHOLD) {
        // the resulting MSB of sighash must be less than the threshold
        preimage = preimage_
        break
    }
  }
  //console.log("preimage args:", inputAmount, genesisTxOutputIndex, sigtype, genesisScript.toBuffer().toString('hex'))
  const sig = signTx(tx, issuerPrivKey, genesisScript.toASM(), inputAmount, inputIndex=genesisTxOutputIndex, sighashType=sigtype)

  // TODO: get genesis from the script code
  const issuerPubKey = issuerPrivKey.publicKey
  const genesis = new Genesis(new PubKey(toHex(issuerPubKey)), new Bytes(Buffer.from(tokenName).toString('hex')), new Bytes(contractHash.toString('hex')), decimalNum)
  console.log('genesis args:', toHex(issuerPubKey), Buffer.from(tokenName).toString('hex'), contractHash.toString('hex'), decimalNum)
  const unlockingScript = genesisContract.unlock(
      new SigHashPreimage(toHex(preimage)),
      new Sig(toHex(sig)),
      new Bytes(lockingScript.toHex()),
      outputSatoshis
  ).toScript()

  //console.log('genesis unlocking args:', toHex(preimage), toHex(sig), lockingScript.toHex(), outputSatoshis)

  tx.inputs[0].setScript(unlockingScript)

  //console.log('creatToken:', tx.verify(), tx.serialize())

  return tx
}

TokenUtil.createTokenTransfer = function(
  tokenInputArray,
  satoshiInputArray,
  rabinPubKey,
  rabinMsgArray,
  rabinPaddingArray,
  rabinSigArray,
  senderPrivKeyArray,
  satoshiInputPrivKeyArray, 
  tokenOutputArray,
  changeSatoshis, // output change satoshis
  changeAddress, // output change address
) {
  const tx = new bsv.Transaction()

  const tokenInputLen = tokenInputArray.length
  let prevouts = Buffer.alloc(0)
  let inputTokenScript
  for (let i = 0; i < tokenInputLen; i++) {
    const tokenInput = tokenInputArray[i]
    const tokenScript = tokenInput.lockingScript
    inputTokenScript = tokenScript
    const inputSatoshis = tokenInput.satoshis
    const txId = tokenInput.txId
    const outputIndex = tokenInput.outputIndex
    // token contract input
    tx.addInput(new bsv.Transaction.Input({
        output: new bsv.Transaction.Output({
          script: tokenScript,
          satoshis: inputSatoshis
        }),
        prevTxId: txId,
        outputIndex: outputIndex,
        script: bsv.Script.empty()
    }))

    // add outputpoint to prevouts
    const indexBuf = Buffer.alloc(4, 0)
    indexBuf.writeUInt32LE(outputIndex)
    const txidBuf = Buffer.from([...Buffer.from(txId, 'hex')].reverse())
    prevouts = Buffer.concat([
      prevouts,
      txidBuf,
      indexBuf
    ])
  }

  for (let i = 0; i < satoshiInputArray.length; i++) {
    const satoshiInput = satoshiInputArray[i]
    const lockingScript = satoshiInput.lockingScript
    const inputSatoshis = satoshiInput.satoshis
    const txId = satoshiInput.txId
    const outputIndex = satoshiInput.outputIndex
    // bsv input to provide fee
    tx.addInput(new bsv.Transaction.Input.PublicKeyHash({
      output: new bsv.Transaction.Output({
        script: lockingScript,
        satoshis: inputSatoshis
      }),
      prevTxId: txId,
      outputIndex: outputIndex,
      script: bsv.Script.empty()
    }))

    // add outputpoint to prevouts
    const indexBuf = Buffer.alloc(4, 0)
    indexBuf.writeUInt32LE(outputIndex)
    const txidBuf = Buffer.from([...Buffer.from(txId, 'hex')].reverse())
    prevouts = Buffer.concat([
      prevouts,
      txidBuf,
      indexBuf
    ])
  }

  let recervierArray = Buffer.alloc(0)
  let receiverTokenAmountArray = Buffer.alloc(0)
  let outputSatoshiArray = Buffer.alloc(0)
  const tokenOutputLen = tokenOutputArray.length
  for (let i = 0; i < tokenOutputLen; i++) {
    const tokenOutput = tokenOutputArray[i]
    const address = tokenOutput.address
    const outputTokenAmount = tokenOutput.tokenAmount
    const outputSatoshis = tokenOutput.satoshis
    const lockingScript = TokenProto.getNewTokenScript(inputTokenScript, address, outputTokenAmount) 
    tx.addOutput(new bsv.Transaction.Output({
        script: lockingScript,
        satoshis: outputSatoshis,
    }))
    recervierArray = Buffer.concat([recervierArray, address.hashBuffer])
    const tokenBuf = Buffer.alloc(8, 0)
    tokenBuf.writeBigUInt64LE(BigInt(outputTokenAmount))
    receiverTokenAmountArray = Buffer.concat([receiverTokenAmountArray, tokenBuf])
    const satoshiBuf = Buffer.alloc(8, 0)
    satoshiBuf.writeBigUInt64LE(BigInt(outputSatoshis))
    outputSatoshiArray = Buffer.concat([outputSatoshiArray, satoshiBuf])
  }

  if (changeSatoshis > 0) {
    const lockingScript = bsv.Script.buildPublicKeyHashOut(changeAddress)
    tx.addOutput(new bsv.Transaction.Output({
      script: lockingScript,
      satoshis: changeSatoshis,
    }))
  }

  const sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
  for (let i = 0; i < tokenInputLen; i++) {
    const senderPrivKey = senderPrivKeyArray[i]
    const tokenInput = tokenInputArray[i]
    const tokenScript = tokenInput.lockingScript
    const satoshis = tokenInput.satoshis
    const outputIndex = tokenInput.outputIndex
    let preimage
    // preimage optimize
    for (let i = 0; ; i++) {
      tx.nLockTime = i
      const preimage_ = getPreimage(tx, tokenScript.toASM(), satoshis, inputIndex=outputIndex, sighashType=sigtype)
      const preimageHex = toHex(preimage_)
      const h = bsv.crypto.Hash.sha256sha256(Buffer.from(preimageHex, 'hex'))
      const msb = h.readUInt8()
      if (msb < MSB_THRESHOLD) {
          // the resulting MSB of sighash must be less than the threshold
          preimage = preimage_
          break
      }
    }

    let sig = signTx(tx, senderPrivKey, tokenScript.toASM(), satoshis, inputIndex=outputIndex, sighashType=sigtype)

    const tokenContract = new Token()
    const unlockingScript = tokenContract.route(
      new SigHashPreimage(toHex(preimage)),
      new PubKey(toHex(senderPrivKey.publicKey)),
      new Sig(toHex(sig)),
      tokenInputLen,
      new Bytes(prevouts.toString('hex')),
      rabinPubKey,
      new Bytes(rabinMsgArray.toString('hex')),
      new Bytes(rabinPaddingArray.toString('hex')),
      new Bytes(rabinSigArray.toString('hex')),
      tokenOutputLen,
      new Bytes(recervierArray.toString('hex')),
      new Bytes(receiverTokenAmountArray.toString('hex')),
      new Bytes(outputSatoshiArray.toString('hex')),
      changeSatoshis,
      new Ripemd160(changeAddress.hashBuffer.toString('hex'))
    ).toScript()
    tx.inputs[i].setScript(unlockingScript)
  }
  //console.log('token transfer args:', toHex(preimage), toHex(senderPrivKey.publicKey), toHex(sig), address1.hashBuffer.toString('hex'), tokenAmount1, outputAmount1, address2.hashBuffer.toString('hex'), tokenAmount2, outputAmount2, chargeScript, changeAmount)

  for (let i = 0; i < satoshiInputArray.length; i++) {
    const privKey = satoshiInputPrivKeyArray[i]
    const outputIndex = satoshiInputArray[i].outputIndex
    const hashData = bsv.crypto.Hash.sha256ripemd160(privKey.publicKey.toBuffer())
    const inputIndex = i + tokenInputLen
    const sig = tx.inputs[inputIndex].getSignatures(tx, privKey, inputIndex, sigtype, hashData)
    tx.inputs[inputIndex].addSignature(tx, sig[0])
  }

  return tx
}