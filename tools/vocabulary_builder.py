#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HSK語彙データベース構築・管理ツール

このスクリプトは以下の機能を提供します：
1. 語彙データの検証
2. 重複チェック
3. JavaScriptフォーマットへの変換
4. 統計情報の生成
"""

import json
import re
import sys
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass
from pathlib import Path

@dataclass
class VocabEntry:
    """語彙エントリ"""
    id: str
    chinese: str
    pinyin: str
    japanese: str
    category: str
    
    def validate(self) -> List[str]:
        """エントリの検証"""
        errors = []
        
        # 必須フィールドチェック
        if not self.id:
            errors.append("IDが空です")
        if not self.chinese:
            errors.append("中国語が空です")
        if not self.pinyin:
            errors.append("ピンインが空です")
        if not self.japanese:
            errors.append("日本語が空です")
        if not self.category:
            errors.append("カテゴリが空です")
            
        # フォーマットチェック
        if self.id and not re.match(r'^[a-z_]+$', self.id):
            errors.append(f"ID '{self.id}' は小文字とアンダースコアのみ使用可能")
            
        # 中国語文字チェック
        if self.chinese and not re.match(r'^[\u4e00-\u9fff\s]+$', self.chinese):
            errors.append(f"中国語 '{self.chinese}' に無効な文字が含まれています")
            
        return errors
    
    def to_js_object(self) -> str:
        """JavaScript形式のオブジェクト文字列に変換"""
        return f'{{ id: "{self.id}", chinese: "{self.chinese}", pinyin: "{self.pinyin}", japanese: "{self.japanese}", category: "{self.category}" }}'

class VocabularyManager:
    """語彙データベース管理クラス"""
    
    def __init__(self):
        self.vocab_data: Dict[str, List[VocabEntry]] = {}
        self.categories = {
            "名詞", "動詞", "形容詞", "副詞", "代詞", "量詞", 
            "助詞", "接続詞", "前置詞", "感嘆詞", "指示詞", "疑問詞", "数詞"
        }
        
    def load_from_csv(self, csv_file: str, hsk_level: int):
        """CSVファイルから語彙データを読み込み"""
        import csv
        entries = []
        
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    entry = VocabEntry(
                        id=row.get('id', ''),
                        chinese=row.get('chinese', ''),
                        pinyin=row.get('pinyin', ''),
                        japanese=row.get('japanese', ''),
                        category=row.get('category', '')
                    )
                    entries.append(entry)
                    
            self.vocab_data[f'hsk{hsk_level}'] = entries
            print(f"HSK{hsk_level}級: {len(entries)}語を読み込みました")
            
        except FileNotFoundError:
            print(f"ファイル '{csv_file}' が見つかりません")
        except Exception as e:
            print(f"CSVファイル読み込みエラー: {e}")
    
    def validate_all(self) -> Dict[str, List[str]]:
        """全語彙の検証"""
        all_errors = {}
        
        for level, entries in self.vocab_data.items():
            level_errors = []
            used_ids = set()
            used_chinese = set()
            
            for i, entry in enumerate(entries):
                # 個別エントリの検証
                entry_errors = entry.validate()
                for error in entry_errors:
                    level_errors.append(f"行{i+1}: {error}")
                
                # 重複チェック
                if entry.id in used_ids:
                    level_errors.append(f"行{i+1}: ID '{entry.id}' が重複しています")
                used_ids.add(entry.id)
                
                if entry.chinese in used_chinese:
                    level_errors.append(f"行{i+1}: 中国語 '{entry.chinese}' が重複しています")
                used_chinese.add(entry.chinese)
                
                # カテゴリ検証
                if entry.category not in self.categories:
                    level_errors.append(f"行{i+1}: 無効なカテゴリ '{entry.category}'")
            
            if level_errors:
                all_errors[level] = level_errors
                
        return all_errors
    
    def generate_javascript(self, output_file: str):
        """JavaScriptファイルを生成"""
        js_content = "// HSK等級別語彙データベース - 自動生成\n"
        js_content += "const hskVocabulary = {\n"
        
        for level in ['hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6']:
            entries = self.vocab_data.get(level, [])
            js_content += f"    // HSK{level[3]}級 ({len(entries)}語)\n"
            js_content += f"    {level}: [\n"
            
            for entry in entries:
                js_content += f"        {entry.to_js_object()},\n"
            
            js_content += "    ],\n\n"
        
        js_content += """};

// HSK語彙取得関数
function getHSKVocabulary(level) {
    return hskVocabulary[`hsk${level}`] || [];
}

// 全HSK語彙取得関数
function getAllHSKVocabulary() {
    const allWords = [];
    for (let i = 1; i <= 6; i++) {
        allWords.push(...getHSKVocabulary(i));
    }
    return allWords;
}"""
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(js_content)
            print(f"JavaScriptファイル '{output_file}' を生成しました")
        except Exception as e:
            print(f"ファイル生成エラー: {e}")
    
    def generate_statistics(self) -> str:
        """統計情報を生成"""
        stats = "=== HSK語彙データベース統計 ===\n\n"
        
        total_words = 0
        for level in ['hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6']:
            entries = self.vocab_data.get(level, [])
            total_words += len(entries)
            stats += f"HSK{level[3]}級: {len(entries)}語\n"
        
        stats += f"\n合計: {total_words}語\n\n"
        
        # カテゴリ別統計
        stats += "=== カテゴリ別統計 ===\n"
        category_counts = {}
        
        for level, entries in self.vocab_data.items():
            for entry in entries:
                category_counts[entry.category] = category_counts.get(entry.category, 0) + 1
        
        for category, count in sorted(category_counts.items()):
            stats += f"{category}: {count}語\n"
        
        return stats
    
    def export_to_csv(self, level: int, output_file: str):
        """指定レベルをCSVエクスポート"""
        import csv
        
        entries = self.vocab_data.get(f'hsk{level}', [])
        if not entries:
            print(f"HSK{level}級のデータがありません")
            return
        
        try:
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'chinese', 'pinyin', 'japanese', 'category'])
                
                for entry in entries:
                    writer.writerow([entry.id, entry.chinese, entry.pinyin, entry.japanese, entry.category])
            
            print(f"HSK{level}級を '{output_file}' にエクスポートしました")
            
        except Exception as e:
            print(f"CSVエクスポートエラー: {e}")

def main():
    """メイン関数"""
    manager = VocabularyManager()
    
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python vocabulary_builder.py validate")
        print("  python vocabulary_builder.py generate")
        print("  python vocabulary_builder.py stats")
        print("  python vocabulary_builder.py load <csv_file> <hsk_level>")
        print("  python vocabulary_builder.py export <hsk_level> <csv_file>")
        return
    
    command = sys.argv[1]
    
    if command == "validate":
        # 現在のJavaScriptファイルから読み込んで検証
        print("語彙データを検証しています...")
        errors = manager.validate_all()
        
        if errors:
            for level, level_errors in errors.items():
                print(f"\n{level}のエラー:")
                for error in level_errors:
                    print(f"  {error}")
        else:
            print("✅ 全ての語彙データが正常です")
    
    elif command == "generate":
        # JavaScriptファイル生成
        output_file = "../assets/words/hsk_vocabulary.js"
        manager.generate_javascript(output_file)
    
    elif command == "stats":
        # 統計情報表示
        print(manager.generate_statistics())
    
    elif command == "load" and len(sys.argv) >= 4:
        # CSVファイル読み込み
        csv_file = sys.argv[2]
        hsk_level = int(sys.argv[3])
        manager.load_from_csv(csv_file, hsk_level)
    
    elif command == "export" and len(sys.argv) >= 4:
        # CSVエクスポート
        hsk_level = int(sys.argv[2])
        csv_file = sys.argv[3]
        manager.export_to_csv(hsk_level, csv_file)
    
    else:
        print("無効なコマンドです")

if __name__ == "__main__":
    main() 