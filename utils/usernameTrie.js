class TrieNode {
  constructor() {
    this.children = {};
    this.isEndOfWord = false;
    this.userId = null;
    this.isVerified = false;
  }
}

class UsernameTrie {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Inserts a username into the Trie cache.
   * @param {string} username 
   * @param {string} userId 
   * @param {boolean} isVerified 
   */
  insert(username, userId, isVerified = false) {
    if (!username || typeof username !== 'string') return;
    
    const normalized = username.toLowerCase().trim();
    let current = this.root;
    
    for (const char of normalized) {
      if (!current.children[char]) {
        current.children[char] = new TrieNode();
      }
      current = current.children[char];
    }
    current.isEndOfWord = true;
    current.userId = userId;
    current.isVerified = isVerified;
  }

  /**
   * Searches for a username in the Trie cache.
   * @param {string} username 
   * @returns {{ userId: string, isVerified: boolean } | null}
   */
  search(username) {
    if (!username || typeof username !== 'string') return null;
    
    const normalized = username.toLowerCase().trim();
    let current = this.root;
    
    for (const char of normalized) {
      if (!current.children[char]) {
        return null;
      }
      current = current.children[char];
    }
    
    if (current.isEndOfWord) {
      return {
        userId: current.userId,
        isVerified: current.isVerified
      };
    }
    return null;
  }

  /**
   * Updates the verification status of a cached username.
   * @param {string} username 
   * @param {boolean} isVerified 
   */
  updateVerification(username, isVerified) {
    if (!username || typeof username !== 'string') return;
    
    const normalized = username.toLowerCase().trim();
    let current = this.root;
    
    for (const char of normalized) {
      if (!current.children[char]) {
        return;
      }
      current = current.children[char];
    }
    
    if (current.isEndOfWord) {
      current.isVerified = isVerified;
    }
  }

  /**
   * Removes a username from the Trie cache.
   * @param {string} username 
   */
  remove(username) {
    if (!username || typeof username !== 'string') return;
    
    const normalized = username.toLowerCase().trim();
    
    const deleteHelper = (node, word, index) => {
      if (index === word.length) {
        if (!node.isEndOfWord) return false;
        node.isEndOfWord = false;
        node.userId = null;
        node.isVerified = false;
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
    
    deleteHelper(this.root, normalized, 0);
  }

  /**
   * Clears the entire Trie cache.
   */
  clear() {
    this.root = new TrieNode();
  }
}

// Global instance of the trie cache
const usernameTrie = new UsernameTrie();

export default usernameTrie;
export { UsernameTrie };
