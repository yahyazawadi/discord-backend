class TrieNode {
  constructor() {
    this.children = {};
    this.isEndOfWord = false;
  }
}

class InviteTrie {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Inserts an invite code into the Trie cache after converting it to uppercase.
   * @param {string} code 
   */
  insert(code) {
    if (!code || typeof code !== 'string') return;
    
    const normalizedCode = code.toUpperCase();
    let current = this.root;
    
    for (const char of normalizedCode) {
      if (!current.children[char]) {
        current.children[char] = new TrieNode();
      }
      current = current.children[char];
    }
    current.isEndOfWord = true;
  }

  /**
   * Searches for an invite code in the Trie cache, returning true if found.
   * @param {string} code 
   * @returns {boolean}
   */
  search(code) {
    if (!code || typeof code !== 'string') return false;
    
    const normalizedCode = code.toUpperCase();
    let current = this.root;
    
    for (const char of normalizedCode) {
      if (!current.children[char]) {
        return false;
      }
      current = current.children[char];
    }
    return current.isEndOfWord;
  }

  /**
   * Removes an invite code from the Trie cache.
   * @param {string} code 
   */
  remove(code) {
    if (!code || typeof code !== 'string') return;
    
    const normalizedCode = code.toUpperCase();
    
    const deleteHelper = (node, word, index) => {
      if (index === word.length) {
        if (!node.isEndOfWord) return false;
        node.isEndOfWord = false;
        return Object.keys(node.children).length === 0;
      }
      
      const char = word[index];
      const nextNode = node.children[char];
      if (!nextNode) return false;
      
      const shouldDeleteCurrentNode = deleteHelper(nextNode, word, index + 1);
      
      if (shouldDeleteCurrentNode) {
        delete node.children[char];
        return Object.keys(node.children).length === 0 && !node.isEndOfWord;
      }
      
      return false;
    };
    
    deleteHelper(this.root, normalizedCode, 0);
  }

  /**
   * Clears the entire Trie cache.
   */
  clear() {
    this.root = new TrieNode();
  }
}

// Global instance of the trie cache
const inviteTrie = new InviteTrie();

export default inviteTrie;
export { InviteTrie };
