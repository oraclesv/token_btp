
const MerkleTree = module.exports

MerkleTree.NODE_LEN = 33

MerkleTree.calculateMerkleRoot = function(leaf, merklePath) {
  const merklePathLength = merklePath.length / MerkleTree.NODE_LEN
  let merkleValue = leaf
  for (let i = 0; i < merklePathLength; i++) {
    const left = merklePath.readUInt8(i * MerkleTree.NODE_LEN + 32)
    if (left === 1) {
      merkleValue = bsv.crypto.sha256(Buffer.concat([
        merkleValue,
        merklePath.subarray(i * MerkleTree.NODE_LEN, i * MerkleTree.NODE_LEN + 32),
      ]))
    } else {
      merkleValue = bsv.crypto.sha256(Buffer.concat([
        merklePath.subarray(i * MerkleTree.NODE_LEN, i * MerkleTree.NODE_LEN + 32),
        merkleValue,
      ]))
    }
  }
  return merkleValue
}

MerkleTree.verifyLeaf = function(leaf, merklePath, merkleRoot) {
  const merkleValue = MerkleTree.calculateMerkleRoot(leaf, merklePath)
  return merkleValue === merkleRoot
}

MerkleTree.updateLeaf = function(oldleaf, newleaf, merklePath, oldMerkleRoot) {
  const merklePathLength = merklePath.length / MerkleTree.NODE_LEN;
  let oldMerkleValue = oldLeaf
  let newMerkleValue = newLeaf

  for (let i = 0; i < merklePathLength; i++) {
    const left = merklePath.readUInt8(i * MerkleTree.NODE_LEN + 32)
    const oldNeighbor = merklePath.subarray(i * MerkleTree.NODE_LEN, i * MerkleTree.NODE_LEN + 32)
    const newNeighbor = oldNeighbor === oldMerkleValue ? newMerkleValue : oldNeighbor;
    if (left === 1) {
      oldMerkleValue = bsv.crypto.sha256(oldMerkleValue + oldNeighbor)
      newMerkleValue = bsv.crypto.sha256(newMerkleValue + newNeighbor)
    } else {
      oldMerkleValue = bsv.crypto.sha256(oldNeighbor + oldMerkleValue)
      newMerkleValue = bsv.crypto.sha256(newNeighbor + newMerkleValue)
    }
  }
  if (oldMerkleValue !== oldMerkleRoot) {
    return null
  }
  return newMerkleValue
}

MerkleTree.addLeaf = function(lastLeaf, lastMerklePath, oldMerkleRoot, newLeaf) {
  if (MerkleTree.verifyLeaf(lastLeaf, lastMerklePath, oldMerkleRoot) === false) {
    return null
  }

  const depth = lastMerklePath.length / MerkleTree.NODE_LEN
  let merkleValue = newLeaf
  let lastLeafValue = lastLeaf
  let joined = false

  for (let i = 0; i < depth; i++) {
    const sibling = lastMerklePath.subarray(i * MerkleTree.NODE_LEN, i * MerkleTree.NODE_LEN + 32)
    const left = lastMerklePath.readUInt8(i * MerkleTree.NODE_LEN + 32)

    if (left === 1) {
      if (joined === true) {
        if (sibling !== merkleValue) {
          return null
        } 
        merkleValue = bsv.crypto.sha256(Buffer.concat([merkleValue, sibling]))
      } else {
        if (sibling !== lastLeafValue) {
          return null
        }
        merkleValue = bsv.crypto.sha256(Buffer.concat([lastLeafValue, merkleValue]))
      }
      joined = true
    } else {
      if (joined === true) {
        merkleValue = bsv.crypto.sha256(Buffer.concat([sibling, merkleValue]))
      } else {
        merkleValue = bsv.crypto.sha256(Buffer.concat([merkleValue, merkleValue]))
        lastLeafValue = bsv.crypto.sha256(Buffer.concat([sibling, lastLeafValue]))
      }
    }

    if (joined === false) {
      merkleValue = bsv.crypto.sha256(Buffer.concat([oldMerkleValue, merkleValue]))
    }
    return merkleValue
  }
}

MerkleTree.addLeafSafe = function(lastEntry, lastMerklePath, oldMerkleRoot, newLeaf) {
  const lastLeaf = bsv.crypto.sha256(lastEntry)
  return MerkleTree.addLeaf(lastLeaf, lastMerklePath, oldMerkleRoot, newLeaf)
}