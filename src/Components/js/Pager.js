import React, { Component } from 'react';
import { FaAngleDoubleRight, FaAngleDoubleLeft, FaAngleRight, FaAngleLeft } from 'react-icons/fa';

import '../css/Pager.css';

class Pager extends Component {
    render() {
        const { changePage, page, results, cls, type } = this.props;
        const visibleSingle = type === 'pirate' ? (page * results.limit < results.total) : results.length >= 20;
        const visibleMultiple = type === 'pirate' ? ((page + 4) * results.limit < results.total) : results.length >= 20;

        return (
            <div className={"pager " + cls}>
                <FaAngleDoubleLeft
                    className="arrow"
                    style={{ display: page > 1 ? "inline-block" : "none" }}
                    onClick={() => changePage(-5)}
                />
                <FaAngleLeft
                    className="arrow"
                    style={{ display: page > 1 ? "inline-block" : "none" }}
                    onClick={() => changePage(-1)}
                />
                <span>{page}</span>
                <FaAngleRight
                    className="arrow"
                    style={{ display: visibleSingle ? "inline-block" : "none" }}
                    onClick={() => changePage(1)}
                />
                <FaAngleDoubleRight
                    className="arrow"
                    style={{ display: visibleMultiple ? "inline-block" : "none" }}
                    onClick={() => changePage(5)}
                />
            </div>
        );
    }
}

export default Pager;