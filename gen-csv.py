
import csv, re

with open('numerical_reasoning_data_interpretation_25.csv', mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

def clean_prompt(prompt):
    if 'Table 2: Exam Passing Rate (%)' in prompt and 'Center | Passing Rate (%)' not in prompt:
        prompt = prompt.replace('Table 2: Exam Passing Rate (%)\nCenter W | 60%', 'Table 2: Exam Passing Rate (%)\nCenter | Passing Rate (%)\nCenter W | 60%')
    lines = [l.strip() for l in prompt.split('\n')]
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if '|' in line and not line.startswith('<'):
            table_lines = []
            while i < len(lines) and '|' in lines[i] and not lines[i].startswith('<'):
                table_lines.append(lines[i])
                i += 1
            if len(table_lines) >= 1:
                headers = [c.strip() for c in table_lines[0].split('|') if c.strip()]
                has_sep = len(table_lines) > 1 and re.match(r'^[\|\s:-]+$', table_lines[1])
                rows_data = table_lines[1:] if not has_sep else table_lines[2:]
                out.append('| ' + ' | '.join(headers) + ' |')
                out.append('| ' + ' | '.join(['---'] * len(headers)) + ' |')
                for r in rows_data:
                    cols = [c.strip() for c in r.split('|') if c.strip()]
                    if not cols: continue
                    while len(cols) < len(headers): cols.append('')
                    out.append('| ' + ' | '.join(cols[:len(headers)]) + ' |')
            continue
        else:
            out.append(line)
            i += 1
    return '\n'.join(out)

for r in rows:
    r['prompt'] = clean_prompt(r['prompt'])

with open('numerical_reasoning_data_interpretation_25_updated.csv', mode='w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print("✅ Successfully generated numerical_reasoning_data_interpretation_25_updated.csv!")
