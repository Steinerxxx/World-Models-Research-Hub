const fs = require('fs');
const path = require('path');

// 获取最新的JSON文件
function getLatestJSONFile() {
  const files = fs.readdirSync('.')
    .filter(file => file.startsWith('arxiv-papers-') && file.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.length > 0 ? files[0] : null;
}

// 格式化显示论文
function displayPapers(data, start = 0, count = 10) {
  const papers = data.papers.slice(start, start + count);
  
  console.log(`\n📚 显示第 ${start + 1} - ${Math.min(start + count, data.totalPapers)} 篇论文 (共 ${data.totalPapers} 篇)`);
  console.log("=" .repeat(80));
  
  papers.forEach((paper, index) => {
    const globalIndex = start + index + 1;
    console.log(`\n${globalIndex}. 📄 ${paper.title}`);
    console.log(`   👥 作者: ${paper.authors.join(', ')}`);
    console.log(`   🔗 摘要: ${paper.abstractLink}`);
    console.log(`   📄 PDF: ${paper.pdfLink}`);
    console.log("-".repeat(80));
  });
}

// 搜索功能
function searchPapers(data, keyword) {
  const results = data.papers.filter(paper => 
    paper.title.toLowerCase().includes(keyword.toLowerCase()) ||
    paper.authors.some(author => author.toLowerCase().includes(keyword.toLowerCase()))
  );
  
  console.log(`\n🔍 搜索关键词 "${keyword}" 找到 ${results.length} 篇论文`);
  console.log("=" .repeat(80));
  
  results.slice(0, 10).forEach((paper, index) => {
    console.log(`\n${index + 1}. 📄 ${paper.title}`);
    console.log(`   👥 作者: ${paper.authors.join(', ')}`);
    console.log(`   🔗 摘要: ${paper.abstractLink}`);
    console.log(`   📄 PDF: ${paper.pdfLink}`);
    console.log("-".repeat(80));
  });
  
  if (results.length > 10) {
    console.log(`\n💡 找到 ${results.length} 篇论文，显示前10篇，建议保存搜索结果到文件查看全部`);
  }
}

// 主程序
function main() {
  const filename = getLatestJSONFile();
  
  if (!filename) {
    console.log("❌ 没有找到论文数据文件，请先运行 node scraper.js 抓取数据");
    return;
  }
  
  console.log(`📂 加载数据文件: ${filename}`);
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  
  console.log("\n🎯 arXiv 论文查看工具");
  console.log("=" .repeat(50));
  console.log("1️⃣ 查看最新论文 (前10篇)");
  console.log("2️⃣ 查看所有论文 (分页显示)");
  console.log("3️⃣ 搜索论文");
  console.log("4️⃣ 保存搜索结果到文件");
  console.log("5️⃣ 查看统计信息");
  console.log("6️⃣ 退出");
  console.log("=" .repeat(50));
  
  // 显示最新10篇
  displayPapers(data, 0, 10);
  
  console.log("\n💡 使用说明:");
  console.log("• 运行 'node view-papers.js 1' 查看最新论文");
  console.log("• 运行 'node view-papers.js 2 20' 查看第21-30篇论文");
  console.log("• 运行 'node view-papers.js 3 GPT' 搜索包含GPT的论文");
  console.log("• 直接打开 JSON 文件查看完整数据");
}

// 处理命令行参数
const args = process.argv.slice(2);
const command = args[0];

if (command === '1') {
  // 查看最新10篇
  const filename = getLatestJSONFile();
  if (filename) {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    displayPapers(data, 0, 10);
  }
} else if (command === '2') {
  // 分页查看
  const start = parseInt(args[1]) || 0;
  const filename = getLatestJSONFile();
  if (filename) {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    displayPapers(data, start, 10);
  }
} else if (command === '3') {
  // 搜索
  const keyword = args[1];
  if (keyword) {
    const filename = getLatestJSONFile();
    if (filename) {
      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      searchPapers(data, keyword);
    }
  } else {
    console.log("❌ 请提供搜索关键词，例如: node view-papers.js 3 GPT");
  }
} else {
  // 显示帮助
  main();
}