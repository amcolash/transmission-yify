import React, { Component } from 'react';
import { FaAngleDoubleRight, FaAngleDoubleLeft, FaAngleRight, FaAngleLeft } from 'react-icons/fa';

import '../css/Pager.css';

class Pager extends Component {
    render() {
        const { changePage, page, results, type } = this.props;
        const visible = type === 'pirate' ? results.length >= 30 : results.length >= 20;

        return (
            <div className={"pager " + type}>
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
                    style={{ display: visible ? "inline-block" : "none" }}
                    onClick={() => changePage(1)}
                />
                <FaAngleDoubleRight
                    className="arrow"
                    style={{ display: visible ? "inline-block" : "none" }}
                    onClick={() => changePage(5)}
                />
            </div>
        );
    }
}

export default Pager;