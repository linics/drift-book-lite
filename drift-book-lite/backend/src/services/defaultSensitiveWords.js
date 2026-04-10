const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/prisma");
const { defaultSensitiveWordsDir } = require("../lib/env");
const { normalizeSensitiveWord } = require("./library");
const { HttpError } = require("../utils/httpError");

function compareNames(left, right) {
  return left.localeCompare(right, "zh-CN");
}

function listDefaultSensitiveWordFiles(dir = defaultSensitiveWordsDir) {
  if (!fs.existsSync(dir)) {
    throw new HttpError(500, `默认敏感词目录不存在：${dir}`);
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
    .map((entry) => path.join(dir, entry.name))
    .sort(compareNames);
}

function collectDefaultSensitiveWords(dir = defaultSensitiveWordsDir) {
  const files = listDefaultSensitiveWordFiles(dir);
  const uniqueWords = new Map();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/u)) {
      const word = String(line || "").trim();
      if (!word) continue;

      const normalizedWord = normalizeSensitiveWord(word);
      if (!normalizedWord || uniqueWords.has(normalizedWord)) continue;

      uniqueWords.set(normalizedWord, {
        word,
        normalizedWord,
      });
    }
  }

  if (uniqueWords.size === 0) {
    throw new HttpError(400, `默认敏感词目录没有可导入的词条：${dir}`);
  }

  return {
    defaultSensitiveWordsDir: dir,
    sourceFiles: files.map((filePath) => path.basename(filePath)),
    words: [...uniqueWords.values()],
  };
}

async function importDefaultSensitiveWords() {
  const { defaultSensitiveWordsDir: dir, sourceFiles, words } = collectDefaultSensitiveWords();
  const normalizedWords = words.map((item) => item.normalizedWord);
  const existingWords = await prisma.sensitiveWord.findMany({
    where: {
      normalizedWord: {
        in: normalizedWords,
      },
    },
    select: {
      normalizedWord: true,
    },
  });
  const existingNormalizedWords = new Set(
    existingWords.map((item) => item.normalizedWord)
  );
  const wordsToCreate = words.filter(
    (item) => !existingNormalizedWords.has(item.normalizedWord)
  );

  if (wordsToCreate.length > 0) {
    await prisma.$transaction(
      wordsToCreate.map((item) =>
        prisma.sensitiveWord.create({
          data: item,
        })
      )
    );
  }

  return {
    totalWords: words.length,
    importedWords: wordsToCreate.length,
    skippedWords: words.length - wordsToCreate.length,
    defaultSensitiveWordsDir: dir,
    sourceFiles,
  };
}

module.exports = {
  collectDefaultSensitiveWords,
  importDefaultSensitiveWords,
};
