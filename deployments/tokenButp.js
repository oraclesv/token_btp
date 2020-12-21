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
    DataLen,
    loadDesc,
    sendTx,
    showError,
} = require('../helper');
const {
    privateKey,
    privateKey2,
} = require('../privateKey');
const utxo1 =  '8f6927c3f0841bdc97e08c604061793c5bed2ad1403f7ffc99c325c0adde9f32'
const outIndex1 = 1
const bsvBalance1 = 720000
const utxo2 = 'e765e837eb636bf1a83436204db9116fdc59c2ef3e56f1afdbe3172b518974b8'
const outIndex2 = 1
const bsvBalance2 = 630000
const utxo3 = 'ea661cb16881896d89719104630be7962258d6a8a22118f5590c45412941b09f'
const outIndex3 = 1
const bsvBalance3 = 1000000

let genesis = null
let tokenContract = null
let Token = null
let TokenID = null

const tokenName = Buffer.alloc(10, 0)
tokenName.write('tcc')
const genesisFlag = Buffer.from('01', 'hex')
const nonGenesisFlag = Buffer.from('00', 'hex')
const tokenType = Buffer.alloc(4, 0)
tokenType.writeUInt32LE(1)
const PROTO_FLAG = Buffer.from('oraclesv')

const tokenValue = 1000000

const address1 = toHex(bsv.crypto.Hash.sha256ripemd160(privateKey.publicKey.toBuffer()))
const address2 = toHex(bsv.crypto.Hash.sha256ripemd160(privateKey2.publicKey.toBuffer()))

function buildTx(lockingScript, inputAmount, outAmount1, outAmount2, utxo, outIndex) {
    const tx = new bsv.Transaction()
    tx.addInput(new bsv.Transaction.Input.PublicKeyHash({
        output: new bsv.Transaction.Output({
          script: bsv.Script.buildPublicKeyHashOut(privateKey.toAddress()),
          satoshis: inputAmount
        }),
        prevTxId: utxo,
        outputIndex: outIndex,
        script: bsv.Script.empty()
    }))

    tx.addOutput(new bsv.Transaction.Output({
        script: lockingScript,
        satoshis: outAmount1,
    }))

    tx.addOutput(new bsv.Transaction.Output({
        script: bsv.Script.buildPublicKeyHashOut(privateKey.toAddress()),
        satoshis: outAmount2,
    }))

    let sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
    let hashData = bsv.crypto.Hash.sha256ripemd160(privateKey.publicKey.toBuffer())
    let sig = tx.inputs[0].getSignatures(tx, privateKey, 0, sigtype, hashData)
    tx.inputs[0].addSignature(tx, sig[0])

    return tx
}

// TODO: fee 

function createGenesisTx() {
    const Genesis = buildContractClass(loadDesc('tokenGenesis_desc.json'))
    genesis = new Genesis(new PubKey(toHex(privateKey.publicKey)), new Bytes(tokenName.toScript('hex')))
    const oracleData = Buffer.concat([
      tokenName,
      genesisFlag, 
      Buffer.alloc(20, 0), // address
      Buffer.alloc(8, 0), // token value
      Buffer.alloc(20, 0), // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    genesis.setDataPart(new Bytes(oracleData.toString('hex')))

    const outAmount1 = 100000
    const fee = 2000
    const outAmount2 = bsvBalance1 - outAmount1 - fee
    const lockingScript = genesis.lockingScript
    const tx = buildTx(lockingScript, bsvBalance1, outAmount1, outAmount2, utxo1, outIndex1)

    console.log('createGenesisTx:', tx.id, tx.serialize())
    return tx
}

function createTokenTx(genesisTx) {
    Token = buildContractClass(loadDesc('tokenButp_desc.json'))
    tokenContract = new Token()

    const prevLockingScript = genesisTx.outputs[0].script

    tokenID = Buffer.from(bsv.crypto.Hash.sha256ripemd160(genesisTx.outputs[0].script.toBuffer()))

    const buffValue = Buffer.alloc(8, 0)
    buffValue.writeBigUInt64LE(tokenValue)
    const oracleData = Buffer.concat([
      tokenName,
      nonGenesisFlag, // genesis flag
      address1, // address
      buffValue, // token value
      tokenID, // script code hash
      tokenType, // type
      PROTO_FLAG
    ])
    tokenContract.setDataPart(oracleData)

    const inputAmount = genesisTx.outputs[0].satoshis

    const tx = new bsv.Transaction()
    tx.addInput(new bsv.Transaction.Input({
      output: new bsv.Transaction.Output({
        script: prevLockingScript,
        satoshis: inputAmount 
      }),
      prevTxId: genesisTx.id,
      outputIndex: 0,
      script: bsv.Script.empty(), // placeholder
    }))

    const lockingScript = tokenContract.lockingScript
    tx.addOutput(new bsv.Transaction.Output({
      script: lockingScript,
      satoshis: 50000,
    }))

    let sigtype = bsv.crypto.Signature.SIGHASH_SINGLE | bsv.crypto.Signature.SIGHASH_FORKID
    const preimage = getPreimage(tx, prevLockingScript.toASM(), inputAmount, inputIndex=0, sighashType=sigtype)
    let sig = signTx(tx, privateKey, prevLockingScript.toASM(), inputAmount, inputIndex=0, sighashType=sigtype)

    const unlockingScript = genesis.unlock(
        new SigHashPreimage(toHex(preimage)),
        new Sig(toHex(sig)),
        new Bytes(lockingScript.toHex())
    ).toScript()

    tx.inputs[0].setScript(unlockingScript)

    console.log('createTokenTx:', tx.id, tx.serialize())
    return tx
}

function createTokenTransferTx(tokenTx) {
    const tx = new bsv.Transaction()
    let inputAmount = tokenTx.outputs[0].satoshis
    let fee = 4000
    let outAmount1 = (inputAmount - fee) / 2
    let outAmount2 = inputAmount - fee - outAmount1
    let tokenAmount1 = 1000
    let tokenAmount2 = tokenValue - tokenAmount1
    let prevLockingScript = tokenTx.outputs[0].script

    tx.addInput(new bsv.Transaction.Input({
        output: new bsv.Transaction.Output({
          script: prevLockingScript,
          satoshis: inputAmount
        }),
        prevTxId: tokenTx.id,
        outputIndex: 0,
        script: bsv.Script.empty()
    }))

    tokenContract = new Token()
    const buffValue = Buffer.alloc(8, 0)
    buffValue.writeBigUInt64LE(tokenAmount1)
    const oracleData = Buffer.concat([
      tokenName,
      nonGenesisFlag, // genesis flag
      address2, // address
      buffValue, // token value
      tokenID, // tokenID
      tokenType, // type
      PROTO_FLAG
    ])
    tokenContract.setDataPart(oracleData)

    const lockingScript = tokenContract.lockingScript
    tx.addOutput(new bsv.Transaction.Output({
        script: lockingScript,
        satoshis: outAmount1,
    }))

    tokenContract = new Token()
    const buffValue2 = Buffer.alloc(8, 0)
    buffValue.writeBigUInt64LE(tokenAmount2)
    const oracleData2 = Buffer.concat([
      tokenName,
      nonGenesisFlag, // genesis flag
      address1, // address
      buffValue2, // token value
      tokenID, // tokenID
      tokenType, // type
      PROTO_FLAG
    ])
    tokenContract.setDataPart(oracleData2) 
    const lockingScript2 = tokenContract.lockingScript
    tx.addOutput(new bsv.Transaction.Output({
        script: lockingScript2,
        satoshis: outAmount2,
    }))

    //console.log("tokenContract: 1", scriptHash, num2bin(tokenAmount1, 8), lockingScript.toHex())
    //console.log("tokenContract: ", address1, num2bin(tokenAmount2, 8), lockingScript2.toHex())

    let sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
    const preimage = getPreimage(tx, prevLockingScript.toASM(), inputAmount, inputIndex=0, sighashType=sigtype)
    let sig = signTx(tx, privateKey, prevLockingScript.toASM(), inputAmount, inputIndex=0, sighashType=sigtype)

    const unlockingScript = tokenContract.split(
        new SigHashPreimage(toHex(preimage)),
        new PubKey(privateKey.publicKey),
        new Sig(toHex(sig)),
        new Ripemd160(scriptHash),
        tokenAmount1,
        outAmount1,
        new Ripemd160(address1),
        tokenAmount2,
        outAmount2
    ).toScript()
    //console.log('createTokenTransferTx unlock args:', toHex(preimage), new PubKey(privateKey.publicKey), toHex(sig), scriptHash, tokenAmount1, outAmount1, address1, tokenAmount2, outAmount2)

    tx.inputs[0].setScript(unlockingScript)

    console.log('createTokenTransferTx tx:', tx.id, tx.serialize())

    return tx
}

(async() => {
    try {
        let genesisTx = createGenesisTx()

        let tokenTx = createTokenTx(genesisTx)

        //let txid = await sendTx(tokenTx)
        //console.log('tokenTx id:', txid)

        let transferTx = createTokenTransferTx(tokenTx)
        //txid = await sendTx(transferTx)
        //console.log('transferTx id:', txid)

    } catch (error) {
        console.log('Failed on testnet')
        showError(error)
    }
})()