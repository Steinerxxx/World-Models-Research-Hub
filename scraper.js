const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const url = 'https://arxiv.org/list/cs/new';

axios.get(url)
  .then(response => {
    const html = response.data;
    const $ = cheerio.load(html);
    const papers = [];

    $('dl dt, dl dd').each((i, elem) => {
      if ($(elem).is('dt')) {
        const titleLink = $(elem).find('a[title="Abstract"]');
        const pdfLink = $(elem).find('a[title="Download PDF"]');
        const paper = {
          title: '',
          authors: [],
          abstractLink: '',
          pdfLink: ''
        };
        if (titleLink.length) {
          paper.abstractLink = 'https://arxiv.org' + titleLink.attr('href');
        }
        if (pdfLink.length) {
            paper.pdfLink = 'https://arxiv.org' + pdfLink.attr('href');
        }
        papers.push(paper);
      } else if ($(elem).is('dd')) {
        const lastPaper = papers[papers.length - 1];
        if (lastPaper) {
            lastPaper.title = $(elem).find('.list-title').text().replace('Title: ', '').trim();
            lastPaper.authors = $(elem).find('.list-authors a').map((i, author) => $(author).text()).get();
        }
      }
    });

    // 显示统计信息
    console.log(`\n🎉 成功抓取到 ${papers.length} 篇论文！\n`);
    
    // 显示前5篇论文的详细信息
    console.log("📋 最新论文预览（前5篇）：");
    console.log("=" .repeat(60));
    
    papers.slice(0, 5).forEach((paper, index) => {
      console.log(`\n${index + 1}. 📄 ${paper.title}`);
      console.log(`   👥 作者: ${paper.authors.join(', ')}`);
      console.log(`   🔗 摘要: ${paper.abstractLink}`);
      console.log(`   📄 PDF: ${paper.pdfLink}`);
      console.log("-".repeat(60));
    });
    
    // 保存到文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `arxiv-papers-${timestamp}.json`;
    
    const dataToSave = {
      scrapeTime: new Date().toISOString(),
      totalPapers: papers.length,
      papers: papers
    };
    
    fs.writeFileSync(filename, JSON.stringify(dataToSave, null, 2));
    console.log(`\n💾 所有论文数据已保存到文件: ${filename}`);
    console.log(`📊 文件包含 ${papers.length} 篇论文的完整信息`);
    
    // 提供查看建议
    console.log("\n🔍 查看建议:");
    console.log("1. 在终端中查看: 上面的预览显示了最新5篇论文");
    console.log(`2. 查看完整数据: 打开文件 ${filename} 查看所有论文信息`);
    console.log("3. 搜索特定论文: 在文件中搜索关键词");
    console.log("4. 定期运行: 可以设置定时任务来获取最新论文");
    
  })
  .catch(error => {
    console.error('❌ 抓取失败:', error.message);
  });