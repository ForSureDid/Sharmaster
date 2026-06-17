"""
Parses "Номенклатура с подчиненными.xlsx" into nom_tree.json.
Run: python3 scripts/parse-nom-tree.py
"""
import json, sys, os
import openpyxl

XLSX = os.path.join(os.path.dirname(__file__), '../All the Files with material here/Номенклатура с подчиненными.xlsx')
OUT  = os.path.join(os.path.dirname(__file__), '../nom_tree.json')

TOP_CATS = {
    'Аксессуары',
    'Все для праздника',
    'Гелий и оборудование',
    'Игрушки',
    'Латексные шары',
    'Разное',
    'Фольгированные шары',
}

def main():
    wb = openpyxl.load_workbook(XLSX)
    ws = wb.active

    top_cats = []
    sub_map  = {}
    products = []
    stack    = {}

    for i, row in enumerate(ws.iter_rows(min_row=2)):
        cell   = row[0]
        indent = int(cell.alignment.indent) if cell.alignment and cell.alignment.indent else 0
        name   = (cell.value or '').strip()
        typ    = (row[1].value or '').strip()

        if not name:
            continue

        stack[indent] = name
        for k in list(stack):
            if k > indent:
                del stack[k]

        if typ == 'Товар':
            top = stack.get(0, '')
            sub = stack.get(2, '')
            if top in TOP_CATS:
                products.append({'name': name, 'topCategory': top, 'subCategory': sub})
        else:
            if indent == 0 and name in TOP_CATS:
                if name not in top_cats:
                    top_cats.append(name)
                    sub_map[name] = []
            elif indent == 2:
                top = stack.get(0, '')
                if top in TOP_CATS and name not in sub_map.get(top, []):
                    sub_map.setdefault(top, []).append(name)

    result = {'topCategories': top_cats, 'subMap': sub_map, 'products': products}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT}")
    print(f"  top: {len(top_cats)}, subs: {sum(len(v) for v in sub_map.values())}, products: {len(products)}")

if __name__ == '__main__':
    main()
